$ErrorActionPreference = 'Stop'

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  throw '未找到 winget，请手工安装 JDK 8/11、Python 3 与 LibreOffice 7+'
}

winget install --exact --id EclipseAdoptium.Temurin.11.JDK --accept-package-agreements --accept-source-agreements
winget install --exact --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
winget install --exact --id TheDocumentFoundation.LibreOffice --accept-package-agreements --accept-source-agreements

Write-Host '运行依赖已安装。请重新打开终端后执行 java -version 与 soffice --version 校验。'
