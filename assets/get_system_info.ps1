param(
    [Parameter(Mandatory=$true)]
    [string]$systemName
)

$ErrorActionPreference = 'Stop'

try {
    $adComputer = Get-ADComputer -Identity $systemName -Properties IPv4Address, OperatingSystem

    $ipAddress = $adComputer.IPv4Address
    $operatingSystem = $adComputer.OperatingSystem

    # Get MAC address from AD
    $macAddress = (Get-ADComputer -Identity $systemName -Properties macaddress).macaddress


    $result = @{
        ipAddress = $ipAddress
        macAddress = $macAddress
        operatingSystem = $operatingSystem
    }

    ConvertTo-Json $result
}
catch {
    Write-Error "An error occurred: $_"
    exit 1
}