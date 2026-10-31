# 环境就绪检查（只读，不安装任何东西）
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File "D:\项目\tools\check-env.ps1"

$targets = @(
    @{ Name = 'git';    Args = @('--version'); Need = 'P0' },
    @{ Name = 'node';   Args = @('--version'); Need = 'P0' },
    @{ Name = 'npm';    Args = @('--version'); Need = 'P0' },
    @{ Name = 'python'; Args = @('--version'); Need = 'P1' },
    @{ Name = 'code';   Args = @('--version'); Need = 'P1' },
    @{ Name = 'java';   Args = @('-version');  Need = 'P2' },
    @{ Name = 'docker'; Args = @('--version'); Need = 'P2' },
    @{ Name = 'mysql';  Args = @('--version'); Need = 'P2' }
)

$ok = 0
$miss = @()

Write-Output ''
Write-Output '  TOOL      STATUS  VERSION                  NEED'
Write-Output '  --------  ------  -----------------------  ----'

foreach ($t in $targets) {
    $p = Get-Command $t.Name -ErrorAction SilentlyContinue
    if ($p) {
        $ver = ''
        try { $ver = [string](& $t.Name @($t.Args) 2>&1 | Select-Object -First 1) } catch { $ver = '?' }
        $ver = $ver.Trim()
        if ($ver.Length -gt 23) { $ver = $ver.Substring(0, 23) }
        Write-Output ('  {0,-8}  OK      {1,-23}  {2}' -f $t.Name, $ver, $t.Need)
        $ok++
    }
    else {
        Write-Output ('  {0,-8}  MISS    {1,-23}  {2}' -f $t.Name, '-', $t.Need)
        $miss += $t
    }
}

Write-Output ''
Write-Output ('  已就绪 {0} / {1}' -f $ok, $targets.Count)
Write-Output ''

$must = @($miss | Where-Object { $_.Need -eq 'P0' })

if ($must.Count -gt 0) {
    Write-Output '  [X] P0 必装项缺失，先装这些再开工：'
    foreach ($m in $must) { Write-Output ('      - {0}' -f $m.Name) }
    Write-Output ''
    Write-Output '      Git : winget install Git.Git        (或 git-scm.com 手动下载)'
    Write-Output '      Node: winget install OpenJS.NodeJS.LTS'
    Write-Output ''
}
elseif ($miss.Count -gt 0) {
    Write-Output '  [OK] P0 齐全。其余按需安装，不影响起步。'
    Write-Output '       参考 04_环境与工具链.md 的优先级表。'
    Write-Output ''
}
else {
    Write-Output '  [OK] 环境完整，可以开工。'
    Write-Output ''
}
