param(
    [Parameter(Mandatory=$true)]
    [string]$filter
)

$ErrorActionPreference = 'Stop'

try {
    $Server = $filter  # Use the $filter parameter as the server name

    $query = @"
    SELECT 
        DB_NAME(database_id) AS DatabaseName, 
        CAST((SUM(size) * 8.0 / 1024) AS DECIMAL(10,2)) AS DatabaseSizeMB, 
        CAST((SUM(CASE WHEN type_desc = 'LOG' THEN size ELSE 0 END) * 8.0 / 1024) AS DECIMAL(10,2)) AS LogSizeMB, 
        CAST((SUM(CASE WHEN type_desc = 'ROWS' THEN FILEPROPERTY(name, 'SpaceUsed') ELSE 0 END) * 8.0 / 1024) AS DECIMAL(10,2)) AS SpaceUsedMB 
    FROM sys.master_files 
    WHERE database_id = DB_ID('TPCentralDB') 
    GROUP BY database_id
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
"@

    $rawResult = sqlcmd -S $Server -U "POSDOMAIN\eczms909" -P "Faktnevim123+" -Q $query -h -1

    if ($null -eq $rawResult -or $rawResult -eq '') {
        @{
            error = "No data returned from SQL query"
            rawOutput = ""
        } | ConvertTo-Json -Compress
    } else {
        $cleanResult = $rawResult -replace '[\r\n]', ''
        $jsonMatch = $cleanResult -match '(\{.*\})'

        if ($jsonMatch) {
            $jsonPart = $Matches[1]
            @{
                result = $jsonPart
            } | ConvertTo-Json -Compress
        } else {
            @{
                error = "Invalid or no JSON result from SQL query"
                rawOutput = $rawResult
            } | ConvertTo-Json -Compress
        }
    }
} catch {
    @{
        error = $_.Exception.Message
        rawOutput = if ($rawResult) { $rawResult } else { "No output" }
        stackTrace = $_.ScriptStackTrace
    } | ConvertTo-Json -Compress
}