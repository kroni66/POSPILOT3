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

    # Retrieve HDD space information
    $hddSpace = (Get-PSDrive -Name C).Used

    $result = @{
        ipAddress = $ipAddress
        macAddress = $macAddress
        operatingSystem = $operatingSystem
        hddSpace = $hddSpace
    }

    ConvertTo-Json $result
}
catch {
    Write-Error "An error occurred: $_"
    exit 1
}
