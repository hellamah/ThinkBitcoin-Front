param(
    [string]$ReleaseName = "thinkbitcoin-front",
    [string]$Namespace = "thinkbitcoin",
    [string]$ChartPath = "$PSScriptRoot/../helm/thinkbitcoin-front",
    [string]$ValuesFile = "$PSScriptRoot/../helm/thinkbitcoin-front/values.yaml",
    [string]$ImageTagFile = "$PSScriptRoot/image-tag",
    [ValidateSet("dev", "desenv", "prod")]
    [string]$Environment,
    [string]$ImageRepository,
    [string]$ImageTag,
    [string]$ViteApiUrl,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$PipelineEnvironmentAliases = @{
    dev    = "desenv"
    desenv = "desenv"
    prod   = "prod"
}

function Write-Log {
    param(
        [ValidateSet("INFO", "WARN", "OK")]
        [string]$Level,
        [string]$Message
    )

    $colorByLevel = @{
        INFO = "Cyan"
        WARN = "Yellow"
        OK   = "Green"
    }

    Write-Host "[$Level] $Message" -ForegroundColor $colorByLevel[$Level]
}

function Resolve-Value {
    param(
        [string]$ExplicitValue,
        [string[]]$EnvironmentVariableCandidates
    )

    if (-not [string]::IsNullOrWhiteSpace($ExplicitValue)) {
        return $ExplicitValue
    }

    foreach ($candidate in $EnvironmentVariableCandidates) {
        $value = [Environment]::GetEnvironmentVariable($candidate)
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return $value
        }
    }

    return $null
}

function Add-SetArgIfValue {
    param(
        [System.Collections.Generic.List[string]]$Args,
        [string]$Key,
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return
    }

    $Args.Add("--set-string")
    $Args.Add("$Key=$Value")
}

$resolvedEnvironment = Resolve-Value -ExplicitValue $Environment -EnvironmentVariableCandidates @("DEPLOY_ENV", "DEPLOY_ENVIRONMENT")
if (-not [string]::IsNullOrWhiteSpace($resolvedEnvironment)) {
    if ($PipelineEnvironmentAliases.ContainsKey($resolvedEnvironment)) {
        $resolvedEnvironment = $PipelineEnvironmentAliases[$resolvedEnvironment]
    }
    else {
        throw "Ambiente '$resolvedEnvironment' não suportado. Use dev, desenv ou prod."
    }
}

$resolvedImageRepository = Resolve-Value -ExplicitValue $ImageRepository -EnvironmentVariableCandidates @("IMAGE_REPOSITORY", "DOCKER_IMAGE_REPOSITORY")
$resolvedImageTag = Resolve-Value -ExplicitValue $ImageTag -EnvironmentVariableCandidates @("IMAGE_TAG", "DOCKER_IMAGE_TAG")
$resolvedViteApiUrl = Resolve-Value -ExplicitValue $ViteApiUrl -EnvironmentVariableCandidates @("VITE_API_URL", "FRONT_VITE_API_URL")

if ([string]::IsNullOrWhiteSpace($resolvedImageTag) -and (Test-Path -Path $ImageTagFile)) {
    $resolvedImageTag = (Get-Content -Path $ImageTagFile -Raw).Trim()
}

if ([string]::IsNullOrWhiteSpace($resolvedImageTag)) {
    throw "Tag da imagem não informada. Use -ImageTag, variável IMAGE_TAG/DOCKER_IMAGE_TAG ou arquivo '$ImageTagFile'."
}

$helmArgs = [System.Collections.Generic.List[string]]::new()
$helmArgs.AddRange([string[]]@(
    "upgrade",
    "--install",
    $ReleaseName,
    $ChartPath,
    "--namespace", $Namespace,
    "--create-namespace",
    "-f", $ValuesFile,
    "--set-string", "image.tag=$resolvedImageTag"
))

Add-SetArgIfValue -Args $helmArgs -Key "image.repository" -Value $resolvedImageRepository
Add-SetArgIfValue -Args $helmArgs -Key "env.viteApiUrl" -Value $resolvedViteApiUrl
Add-SetArgIfValue -Args $helmArgs -Key "global.environment" -Value $resolvedEnvironment

if ($DryRun) {
    $helmArgs.Add("--dry-run")
    $helmArgs.Add("--debug")
}

Write-Log -Level INFO -Message "Validando chart Helm em '$ChartPath'."
helm lint $ChartPath

Write-Log -Level INFO -Message "Resumo do deploy: release='$ReleaseName', namespace='$Namespace', imageTag='$resolvedImageTag'."
if (-not [string]::IsNullOrWhiteSpace($resolvedImageRepository)) {
    Write-Log -Level INFO -Message "Override image.repository='$resolvedImageRepository'."
}
if (-not [string]::IsNullOrWhiteSpace($resolvedViteApiUrl)) {
    Write-Log -Level INFO -Message "Override env.viteApiUrl configurado."
}
if (-not [string]::IsNullOrWhiteSpace($resolvedEnvironment)) {
    Write-Log -Level INFO -Message "Ambiente resolvido para '$resolvedEnvironment'."
}

Write-Log -Level INFO -Message "Executando Helm upgrade/install..."
helm @helmArgs
if ($LASTEXITCODE -ne 0) { throw "Execução do Helm falhou com código $LASTEXITCODE." }

Write-Log -Level OK -Message "Deploy Helm concluído."
