param(
    [string]$filter,
    [string]$selectedServer
)

$ErrorActionPreference = 'Stop'
# Set shorter timeout for faster failure on unreachable systems
$connectionTimeout = 2

# Get all systems at once
$systems = Get-ADComputer -Filter $filter -Properties Name,IPv4Address | Sort-Object Name
$result = @()

# Create a script block for parallel processing
$scriptBlock = {
    param($system, $selectedServer)
    
    # Include the Get-SCOArchitecture function inside the scriptblock
    function Get-SCOArchitecture($scoName, $server) {
        $configPath = "\\$server\c$\ProgramData\Wincor Nixdorf\TPiSCAN\admin-server\server\work\webdav\instore-deploy\config\SystemGroupConfig.xml"
        if (Test-Path $configPath) {
            try {
                $xml = [xml](Get-Content $configPath)
                $lanesAndAttSt = $xml.SelectSingleNode("//systemGroup[@name='LanesAndAttSt']").hostNamePattern
                $lanes64 = $xml.SelectSingleNode("//systemGroup[@name='Lanes64']").hostNamePattern
                
                if ($lanesAndAttSt -match $scoName) {
                    return "x86"
                } elseif ($lanes64 -match $scoName) {
                    return "x64"
                }
            } catch {
                Write-Warning "Error reading SystemGroupConfig.xml: $_"
            }
        }
        return "unknown"
    }
    
    $systemInfo = @{
        Name = $system.Name
        Type = if ($system.Name -like 'SCO*') { 'SCO' } else { 'POS' }
        SCOType = 'unknown'
        Architecture = 'N/A'
        IsOnline = $false
        ipAddress = $system.IPv4Address
        Motherboard = 'N/A'
        Printer = $null
        NetworkAnalyzer = 'Not Available' # P00c3
    }

    # Quick ping check with timeout
    $ping = Test-Connection -ComputerName $system.Name -Count 1 -Quiet
    $systemInfo.IsOnline = $ping

    if ($systemInfo.Type -eq 'SCO' -and $ping) {
        try {
            # Use CIM instead of WMI with timeout handling and retry logic
            $attempts = 3
            $retryDelay = 2
            $accessDenied = $false
            
            for ($i = 0; $i -lt $attempts; $i++) {
                try {
                    $cimSessionOptions = New-CimSessionOption -Protocol DCOM
                    $cimSession = New-CimSession -ComputerName $system.Name -SessionOption $cimSessionOptions -OperationTimeoutSec 10 -ErrorAction Stop
                    
                    if ($cimSession) {
                        $wmiResult = Get-CimInstance -CimSession $cimSession -ClassName Win32_BaseBoard -ErrorAction Stop
                        if ($wmiResult -and $wmiResult.Product) {
                            $systemInfo.Motherboard = $wmiResult.Product
                            break
                        }
                    }
                }
                catch {
                    if ($_.Exception.Message -like "*Access is denied*") {
                        $accessDenied = $true
                        Write-Warning "Access denied when getting motherboard info for $($system.Name)"
                        break  # Exit the retry loop if access is denied
                    }
                    Write-Warning "Attempt $($i + 1) failed to get motherboard info for $($system.Name): $_"
                    if ($i -lt $attempts - 1) {
                        Start-Sleep -Seconds $retryDelay
                    }
                }
                finally {
                    if ($cimSession) {
                        Remove-CimSession -CimSession $cimSession -ErrorAction SilentlyContinue
                    }
                }
            }

            # If still no motherboard info and not access denied, try alternative WMI approach
            if ($systemInfo.Motherboard -eq 'N/A' -and -not $accessDenied) {
                try {
                    $wmiResult = Get-WmiObject -ComputerName $system.Name -Class Win32_BaseBoard -ErrorAction Stop
                    if ($wmiResult -and $wmiResult.Product) {
                        $systemInfo.Motherboard = $wmiResult.Product
                    }
                }
                catch {
                    if ($_.Exception.Message -like "*Access is denied*") {
                        Write-Warning "Access denied when getting motherboard info using WMI for $($system.Name)"
                    } else {
                        Write-Warning "Alternative WMI approach failed for $($system.Name): $_"
                    }
                }
            }

            # Get printer info
            try {
                $reg = [Microsoft.Win32.RegistryKey]::OpenRemoteBaseKey('LocalMachine', $system.Name)
                $key = $reg.OpenSubKey('SOFTWARE\WOW6432Node\OLEforRetail\ServiceOPOS\POSPrinter')
                if ($key) {
                    $printerKeys = $key.GetSubKeyNames()
                    foreach ($printerKey in $printerKeys) {
                        if ($printerKey.StartsWith('DN_POSPrinter_')) {
                            $systemInfo.Printer = $printerKey.Replace('DN_POSPrinter_', '')
                            break
                        }
                    }
                }
            } catch {
                Write-Warning "Error accessing registry for $($system.Name): $_"
                $systemInfo.Printer = "Not Available"
                # Set system as offline if network path is not found
                if ($_.Exception.Message -like "*network path was not found*") {
                    $systemInfo.IsOnline = $false
                    $systemInfo.SCOType = "Not Available"
                    $systemInfo.Architecture = "Not Available"
                    $systemInfo.Motherboard = "Not Available"
                    # Don't throw an error, just continue with the not available status
                    return [PSCustomObject]$systemInfo
                }
            }

            # Check SCO type from registry
            try {
                if ($systemInfo.Type -eq 'SCO' -and $systemInfo.IsOnline) {
                    $reg = [Microsoft.Win32.RegistryKey]::OpenRemoteBaseKey('LocalMachine', $system.Name)
                    $key = $reg.OpenSubKey('SOFTWARE\Wincor Nixdorf')
                    
                    if ($key) {
                        $scoType = $key.GetValue('SCOtype')
                        if ($scoType) {
                            $systemInfo.SCOType = $scoType.ToString()
                        } else {
                            Write-Warning "SCOtype value not found in registry for $($system.Name)"
                            $systemInfo.SCOType = "Not Available"
                        }
                        $key.Close()
                    } else {
                        Write-Warning "Registry key not found for $($system.Name)"
                        $systemInfo.SCOType = "Not Available"
                    }
                    $reg.Close()
                }
            } catch {
                Write-Warning "Error checking SCO type in registry for $($system.Name): $_"
                $systemInfo.SCOType = "Not Available"
                if ($_.Exception.Message -like "*network path was not found*") {
                    $systemInfo.IsOnline = $false
                }
            }

            # Get architecture
            try {
                $systemInfo.Architecture = Get-SCOArchitecture $system.Name $selectedServer
            } catch {
                Write-Warning "Error getting architecture for $($system.Name): $_"
                $systemInfo.Architecture = "Not Available"
            }

            # Get motherboard info with timeout and error handling
            try {
                $systemInfo.Motherboard = "Not Available"
                if ($systemInfo.IsOnline) {
                    $cimSessionOptions = New-CimSessionOption -Protocol DCOM
                    $cimSession = New-CimSession -ComputerName $system.Name -SessionOption $cimSessionOptions -OperationTimeoutSec 10 -ErrorAction Stop
                    
                    if ($cimSession) {
                        $wmiResult = Get-CimInstance -CimSession $cimSession -ClassName Win32_BaseBoard -ErrorAction Stop
                        if ($wmiResult -and $wmiResult.Product) {
                            $systemInfo.Motherboard = $wmiResult.Product
                        }
                    }
                }
            } catch {
                Write-Warning "Error getting motherboard info for $($system.Name): $_"
                $systemInfo.Motherboard = "Not Available"
            } finally {
                if ($cimSession) {
                    Remove-CimSession -CimSession $cimSession -ErrorAction SilentlyContinue
                }
            }

            # Retrieve network analyzer information
            try {
                $networkAnalyzerPath = "\\$($system.Name)\c$\Program Files\NetworkAnalyzer\config.xml"
                if (Test-Path $networkAnalyzerPath) {
                    $networkAnalyzerConfig = [xml](Get-Content $networkAnalyzerPath)
                    $systemInfo.NetworkAnalyzer = $networkAnalyzerConfig.SelectSingleNode("//Analyzer/Type").InnerText
                }
            } catch {
                Write-Warning "Error retrieving network analyzer information for $($system.Name): $_"
                $systemInfo.NetworkAnalyzer = "Not Available"
            }
        }
        catch {
            Write-Warning "Error processing $($system.Name): $_"
            # Still return basic system info even if detailed info collection fails
            $systemInfo.SCOType = "Not Available"
            $systemInfo.Architecture = "Not Available"
            $systemInfo.Motherboard = "Not Available"
            $systemInfo.Printer = "Not Available"
            $systemInfo.NetworkAnalyzer = "Not Available" # Pdbda
        }
    }

    return [PSCustomObject]$systemInfo
}

# Process systems in parallel using jobs
$jobs = @()
$maxConcurrentJobs = 10 # Adjust based on server capacity
$processedJobs = @{}  # Track which jobs we've already processed

foreach ($system in $systems) {
    # Wait if we have too many concurrent jobs
    while ((Get-Job -State Running).Count -ge $maxConcurrentJobs) {
        Start-Sleep -Milliseconds 100
        Get-Job -State Completed | Where-Object { -not $processedJobs.ContainsKey($_.Id) } | ForEach-Object {
            $result += Receive-Job -Job $_
            $processedJobs[$_.Id] = $true
            Remove-Job -Job $_ -ErrorAction SilentlyContinue
        }
    }

    $jobs += Start-Job -ScriptBlock $scriptBlock -ArgumentList $system,$selectedServer
}

# Wait for remaining jobs and collect results
Wait-Job -Job $jobs | Out-Null
foreach ($job in $jobs) {
    if (-not $processedJobs.ContainsKey($job.Id)) {
        $result += Receive-Job -Job $job
        $processedJobs[$job.Id] = $true
        Remove-Job -Job $job -ErrorAction SilentlyContinue
    }
}

# Clean up any remaining jobs
Get-Job | Where-Object { -not $processedJobs.ContainsKey($_.Id) } | Remove-Job -ErrorAction SilentlyContinue

try {
    # Filter out any null or empty values to ensure clean JSON
    $cleanResult = $result | ForEach-Object {
        $cleanSystem = [PSCustomObject]@{
            Name = $_.Name
            Type = $_.Type
            SCOType = if ($_.SCOType) { $_.SCOType } else { "Not Available" }
            Architecture = if ($_.Architecture) { $_.Architecture } else { "Not Available" }
            IsOnline = $_.IsOnline
            ipAddress = if ($_.ipAddress) { $_.ipAddress } else { "Not Available" }
            Motherboard = if ($_.Motherboard) { $_.Motherboard } else { "Not Available" }
            Printer = if ($_.Printer) { $_.Printer } else { "Not Available" }
            NetworkAnalyzer = if ($_.NetworkAnalyzer) { $_.NetworkAnalyzer } else { "Not Available" } # Pdbda
        }
        $cleanSystem
    }
    
    $jsonResult = $cleanResult | ConvertTo-Json -Depth 5
    Write-Output $jsonResult
} catch {
    Write-Error "Error converting result to JSON: $_"
    exit 1
}
