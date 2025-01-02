param(
    [Parameter(Mandatory=$true)]
    [string]$ComputerName
)

$Command = "shutdown /r /f /t 05 /m \\$ComputerName"
Invoke-Expression $Command