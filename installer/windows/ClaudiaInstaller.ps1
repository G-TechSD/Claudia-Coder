<#
.SYNOPSIS
    Claudia Coder Single-File Windows Installer

.DESCRIPTION
    Self-contained PowerShell installer that embeds all required files as base64.
    Can be converted to .exe using ps2exe for true single-file distribution.

    This script:
    - Extracts embedded files to the installation directory
    - Installs prerequisites (Docker Desktop, etc.)
    - Configures the environment
    - Creates shortcuts and registry entries
    - Provides a professional installation experience

.PARAMETER InstallDir
    Installation directory (default: C:\ClaudiaCoder)

.PARAMETER Silent
    Run in silent mode without prompts

.PARAMETER Uninstall
    Remove Claudia Coder from the system

.EXAMPLE
    .\ClaudiaInstaller.ps1
    .\ClaudiaInstaller.ps1 -InstallDir "D:\MyApps\Claudia"
    .\ClaudiaInstaller.ps1 -Silent
    .\ClaudiaInstaller.ps1 -Uninstall

.NOTES
    Version:        1.0.0
    Author:         Claudia Coder Team
    Requires:       Windows 10/11, PowerShell 5.1+, Administrator privileges
#>

#Requires -RunAsAdministrator

[CmdletBinding()]
param(
    [string]$InstallDir = "C:\ClaudiaCoder",
    [switch]$Silent,
    [switch]$Uninstall
)

# =============================================================================
# EMBEDDED FILES (Base64 Encoded)
# =============================================================================
# These are the actual installation files encoded as base64 strings.
# They will be decoded and extracted during installation.

$Script:EmbeddedFiles = @{

# -----------------------------------------------------------------------------
# docker-compose.yml
# -----------------------------------------------------------------------------
"docker-compose.yml" = @"
IyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09
PT09PT09PT09PT09PQojIENsYXVkaWEgQ29kZXIgLSBXaW5kb3dzIERvY2tlciBDb21wb3NlIENv
bmZpZ3VyYXRpb24KIyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09
PT09PT09PT09PT09PT09PT09PT09PT09PT09PQoKdmVyc2lvbjogIjMuOCIKCnNlcnZpY2VzOgog
ICMgQ29yZSBBcHBsaWNhdGlvbgogIGNsYXVkaWEtY29kZXI6CiAgICBpbWFnZTogZ2hjci5pby9j
bGF1ZGlhLWNvZGVyL2NsYXVkaWEtY29kZXI6bGF0ZXN0CiAgICBjb250YWluZXJfbmFtZTogY2xh
dWRpYS1jb2RlcgogICAgcmVzdGFydDogdW5sZXNzLXN0b3BwZWQKICAgIHBvcnRzOgogICAgICAt
ICIzMDAwOjMwMDAiCiAgICBlbnZpcm9ubWVudDoKICAgICAgLSBOT0RFX0VOVj1wcm9kdWN0aW9u
CiAgICAgIC0gUE9SVD0zMDAwCiAgICB2b2x1bWVzOgogICAgICAtIGNsYXVkaWEtZGF0YTovYXBw
L2RhdGEKICAgIGV4dHJhX2hvc3RzOgogICAgICAtICJob3N0LmRvY2tlci5pbnRlcm5hbDpob3N0
LWdhdGV3YXkiCiAgICBkZXBlbmRzX29uOgogICAgICBwb3N0Z3JlczoKICAgICAgICBjb25kaXRp
b246IHNlcnZpY2VfaGVhbHRoeQogICAgICByZWRpczoKICAgICAgICBjb25kaXRpb246IHNlcnZp
Y2VfaGVhbHRoeQogICAgbmV0d29ya3M6CiAgICAgIC0gY2xhdWRpYS1uZXR3b3JrCgogICMgR2l0
TGFiIENFCiAgZ2l0bGFiOgogICAgaW1hZ2U6IGdpdGxhYi9naXRsYWItY2U6bGF0ZXN0CiAgICBj
b250YWluZXJfbmFtZTogY2xhdWRpYS1naXRsYWIKICAgIHJlc3RhcnQ6IHVubGVzcy1zdG9wcGVk
CiAgICBwb3J0czoKICAgICAgLSAiODkyOTo4MCIKICAgICAgLSAiMjIyMjoyMiIKICAgIGVudmly
b25tZW50OgogICAgICBHSVRMQUJfT01OSUJVU19DT05GSUc6IHwKICAgICAgICBleHRlcm5hbF91
cmwgJ2h0dHA6Ly9sb2NhbGhvc3Q6ODkyOScKICAgICAgICBnaXRsYWJfcmFpbHNbJ2dpdGxhYl9z
aGVsbF9zc2hfcG9ydCddID0gMjIyMgogICAgICAgIHBvc3RncmVzcWxbJ2VuYWJsZSddID0gZmFs
c2UKICAgICAgICBnaXRsYWJfcmFpbHNbJ2RiX2hvc3QnXSA9ICdwb3N0Z3JlcycKICAgICAgICBn
aXRsYWJfcmFpbHNbJ2RiX3BvcnQnXSA9IDU0MzIKICAgICAgICBnaXRsYWJfcmFpbHNbJ2RiX3Vz
ZXJuYW1lJ10gPSAnZ2l0bGFiJwogICAgICAgIGdpdGxhYl9yYWlsc1snZGJfcGFzc3dvcmQnXSA9
ICdnaXRsYWJfcGFzc3dvcmQnCiAgICAgICAgZ2l0bGFiX3JhaWxzWydkYl9kYXRhYmFzZSddID0g
J2dpdGxhYmhxX3Byb2R1Y3Rpb24nCiAgICAgICAgcmVkaXNbJ2VuYWJsZSddID0gZmFsc2UKICAg
ICAgICBnaXRsYWJfcmFpbHNbJ3JlZGlzX2hvc3QnXSA9ICdyZWRpcycKICAgICAgICBwdW1hWyd3
b3JrZXJfcHJvY2Vzc2VzJ10gPSAyCiAgICAgICAgcHJvbWV0aGV1c19tb25pdG9yaW5nWydlbmFi
bGUnXSA9IGZhbHNlCiAgICB2b2x1bWVzOgogICAgICAtIGdpdGxhYi1jb25maWc6L2V0Yy9naXRs
YWIKICAgICAgLSBnaXRsYWItbG9nczovdmFyL2xvZy9naXRsYWIKICAgICAgLSBnaXRsYWItZGF0
YTovdmFyL29wdC9naXRsYWIKICAgIGRlcGVuZHNfb246CiAgICAgIHBvc3RncmVzOgogICAgICAg
IGNvbmRpdGlvbjogc2VydmljZV9oZWFsdGh5CiAgICAgIHJlZGlzOgogICAgICAgIGNvbmRpdGlv
bjogc2VydmljZV9oZWFsdGh5CiAgICBuZXR3b3JrczoKICAgICAgLSBjbGF1ZGlhLW5ldHdvcmsK
ICAgIHNobV9zaXplOiAnMjU2bScKCiAgIyBQb3N0Z3JlU1FMCiAgcG9zdGdyZXM6CiAgICBpbWFn
ZTogcG9zdGdyZXM6MTUtYWxwaW5lCiAgICBjb250YWluZXJfbmFtZTogY2xhdWRpYS1wb3N0Z3Jl
cwogICAgcmVzdGFydDogdW5sZXNzLXN0b3BwZWQKICAgIGVudmlyb25tZW50OgogICAgICBQT1NU
R1JFU19VU0VSOiBnaXRsYWIKICAgICAgUE9TVEdSRVNfUEFTU1dPUkQ6IGdpdGxhYl9wYXNzd29y
ZAogICAgICBQT1NUR1JFU19EQjogZ2l0bGFiaHFfcHJvZHVjdGlvbgogICAgdm9sdW1lczoKICAg
ICAgLSBwb3N0Z3Jlcy1kYXRhOi92YXIvbGliL3Bvc3RncmVzcWwvZGF0YQogICAgaGVhbHRoY2hl
Y2s6CiAgICAgIHRlc3Q6IFsiQ01ELVNIRUxMIiwgInBnX2lzcmVhZHkgLVUgZ2l0bGFiIl0KICAg
ICAgaW50ZXJ2YWw6IDEwcwogICAgICB0aW1lb3V0OiA1cwogICAgICByZXRyaWVzOiA1CiAgICBu
ZXR3b3JrczoKICAgICAgLSBjbGF1ZGlhLW5ldHdvcmsKCiAgIyBSZWRpcwogIHJlZGlzOgogICAg
aW1hZ2U6IHJlZGlzOjctYWxwaW5lCiAgICBjb250YWluZXJfbmFtZTogY2xhdWRpYS1yZWRpcwog
ICAgcmVzdGFydDogdW5sZXNzLXN0b3BwZWQKICAgIHZvbHVtZXM6CiAgICAgIC0gcmVkaXMtZGF0
YTovZGF0YQogICAgaGVhbHRoY2hlY2s6CiAgICAgIHRlc3Q6IFsiQ01EIiwgInJlZGlzLWNsaSIs
ICJwaW5nIl0KICAgICAgaW50ZXJ2YWw6IDEwcwogICAgICB0aW1lb3V0OiA1cwogICAgICByZXRy
aWVzOiA1CiAgICBuZXR3b3JrczoKICAgICAgLSBjbGF1ZGlhLW5ldHdvcmsKICAgIGNvbW1hbmQ6
IHJlZGlzLXNlcnZlciAtLWFwcGVuZG9ubHkgeWVzIC0tbWF4bWVtb3J5IDI1Nm1iCgogICMgbjhu
IFdvcmtmbG93IEF1dG9tYXRpb24KICBuOG46CiAgICBpbWFnZTogbjhuaW8vbjhuOmxhdGVzdAog
ICAgY29udGFpbmVyX25hbWU6IGNsYXVkaWEtbjhuCiAgICByZXN0YXJ0OiB1bmxlc3Mtc3RvcHBl
ZAogICAgcG9ydHM6CiAgICAgIC0gIjU2Nzg6NTY3OCIKICAgIGVudmlyb25tZW50OgogICAgICAt
IE44Tl9QT1JUPTU2NzgKICAgICAgLSBOOE5fQkFTSUNfQVVUSF9BQ1RJVkU9dHJ1ZQogICAgICAt
IE44Tl9CQVNJQ19BVVRIX1VTRVI9YWRtaW4KICAgICAgLSBOOE5fQkFTSUNfQVVUSF9QQVNTV09S
RD1jbGF1ZGlhCiAgICB2b2x1bWVzOgogICAgICAtIG44bi1kYXRhOi9ob21lL25vZGUvLm44bgog
ICAgbmV0d29ya3M6CiAgICAgIC0gY2xhdWRpYS1uZXR3b3JrCiAgICBwcm9maWxlczoKICAgICAg
LSBhdXRvbWF0aW9uCiAgICAgIC0gYWxsCgogICMgV2hpc3BlcgogIHdoaXNwZXI6CiAgICBpbWFn
ZTogZmVkaXJ6L2Zhc3Rlci13aGlzcGVyLXNlcnZlcjpsYXRlc3QtY3B1CiAgICBjb250YWluZXJf
bmFtZTogY2xhdWRpYS13aGlzcGVyCiAgICByZXN0YXJ0OiB1bmxlc3Mtc3RvcHBlZAogICAgcG9y
dHM6CiAgICAgIC0gIjgwMDA6ODAwMCIKICAgIGVudmlyb25tZW50OgogICAgICAtIFdISVNQRVJf
X01PREVMPVN5c3RyYW4vZmFzdGVyLXdoaXNwZXItc21hbGwKICAgICAgLSBXSElTUEVSX19JTkZF
UkVOQ0VfREVWSUNFPWNwdQogICAgdm9sdW1lczoKICAgICAgLSB3aGlzcGVyLW1vZGVsczovYXBw
L21vZGVscwogICAgbmV0d29ya3M6CiAgICAgIC0gY2xhdWRpYS1uZXR3b3JrCiAgICBwcm9maWxl
czoKICAgICAgLSB2b2ljZQogICAgICAtIGFsbAoKdm9sdW1lczoKICBjbGF1ZGlhLWRhdGE6CiAg
Z2l0bGFiLWNvbmZpZzoKICBnaXRsYWItbG9nczoKICBnaXRsYWItZGF0YToKICBwb3N0Z3Jlcy1k
YXRhOgogIHJlZGlzLWRhdGE6CiAgbjhuLWRhdGE6CiAgd2hpc3Blci1tb2RlbHM6CgpuZXR3b3Jr
czoKICBjbGF1ZGlhLW5ldHdvcms6CiAgICBkcml2ZXI6IGJyaWRnZQo=
"@

# -----------------------------------------------------------------------------
# config.json
# -----------------------------------------------------------------------------
"config.json" = @"
ewogICJ2ZXJzaW9uIjogIjEuMC4wIiwKICAic2VydmljZXMiOiB7CiAgICAiY2xhdWRpYSI6IHsg
InVybCI6ICJodHRwOi8vbG9jYWxob3N0OjMwMDAiIH0sCiAgICAiZ2l0bGFiIjogeyAidXJsIjog
Imh0dHA6Ly9sb2NhbGhvc3Q6ODkyOSIgfSwKICAgICJuOG4iOiB7ICJ1cmwiOiAiaHR0cDovL2xv
Y2FsaG9zdDo1Njc4IiB9LAogICAgIndoaXNwZXIiOiB7ICJ1cmwiOiAiaHR0cDovL2xvY2FsaG9z
dDo4MDAwIiB9CiAgfSwKICAiZGVmYXVsdEFkbWluIjogewogICAgImVtYWlsIjogImFkbWluQGNs
YXVkaWFjb2Rlci5sb2NhbCIsCiAgICAicGFzc3dvcmQiOiAiQ2xhdWRpYUFkbWluMjAyNCEiCiAg
fQp9Cg==
"@

# -----------------------------------------------------------------------------
# .env.template
# -----------------------------------------------------------------------------
".env.template" = @"
IyBDbGF1ZGlhIENvZGVyIENvbmZpZ3VyYXRpb24KIyA9PT09PT09PT09PT09PT09PT09PT09PT09
PQoKIyBDb3JlIFNlcnZpY2UKQ0xBVURJQV9QT1JUPTMwMDAKQ0xBVURJQV9IT1NUPWxvY2FsaG9z
dAoKIyBHaXRMYWIKR0lUTEFCX1BPUlQ9ODkyOQpHSVRMQUJfU1NIX1BPUlQ9MjIyMgpHSVRMQUJf
Uk9PVF9QQVNTV09SRD1DbGF1ZGlhQWRtaW4yMDI0IQoKIyBuOG4KTjhOX1BPUlQ9NTY3OApOOE5f
QkFTSUNfQVVUSF9VU0VSPWFkbWluCk44Tl9CQVNJQ19BVVRIX1BBU1NXT1JEPUNsYXVkaWFBZG1p
bjIwMjQhCgojIFdoaXNwZXIKV0hJU1BFUl9QT1JUPTgwMDAKV0hJU1BFUl9NT0RFTD1zbWFsbAoK
IyBMTSBTdHVkaW8gKG9wdGlvbmFsKQpMTVNUVURJT19VUkw9aHR0cDovL2hvc3QuZG9ja2VyLmlu
dGVybmFsOjEyMzQKCiMgRGF0YWJhc2UKUE9TVEdSRVNfUEFTU1dPUkQ9Y2xhdWRpYV9kYl9wYXNz
d29yZAoKIyBQYXRocwpJTlNUQUxMX0RJUj1DOlxDbGF1ZGlhQ29kZXIKREFUQV9ESVI9QzpcQ2xh
dWRpYUNvZGVyXGRhdGEK
"@

# -----------------------------------------------------------------------------
# start-claudia.bat
# -----------------------------------------------------------------------------
"start-claudia.bat" = @"
QGVjaG8gb2ZmCnNldGxvY2FsIGVuYWJsZWRlbGF5ZWRleHBhbnNpb24KCnRpdGxlIENsYXVkaWEg
LSBTdGFydGluZyBTZXJ2aWNlcwoKZWNoby4KZWNobyA9PT09PT09PT09PT09PT09PT09PT09PT09
PT09PT09PT09PT09PT09PT09PT09PT09CmVjaG8gICAgICAgICAgICAgICAgIFNUQVJUSU5HIENM
QVVESUEgU0VSVklDRVMKZWNobyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09
PT09PT09PT09PT09CmVjaG8uCgplY2hvIFsxLzRdIENoZWNraW5nIERvY2tlciBzdGF0dXMuLi4K
ZG9ja2VyIGluZm8gPm51bCAyPiYxCmlmICVlcnJvckxldmVsJSBuZXEgMCAoCiAgICBlY2hvLgog
ICAgZWNobyBbRVJST1JdIERvY2tlciBpcyBub3QgcnVubmluZy4KICAgIGVjaG8gUGxlYXNlIHN0
YXJ0IERvY2tlciBEZXNrdG9wIGFuZCB0cnkgYWdhaW4uCiAgICBlY2hvLgogICAgZ290byA6ZXJy
b3IKKQplY2hvICAgICAgIERvY2tlciBpcyBydW5uaW5nLgoKZWNoby4KZWNobyBbMi80XSBMb2Nh
dGluZyBjb25maWd1cmF0aW9uLi4uCnNldCAiU0NSSVBUX0RJUj0lfmRwMCIKc2V0ICJDT01QT1NF
X0ZJTEU9JVNDUklQVF9ESVIlZG9ja2VyLWNvbXBvc2UueW1sIgoKaWYgbm90IGV4aXN0ICIhQ09N
UE9TRV9GSUxFISIgKAogICAgZWNobyBbRVJST1JdIENvdWxkIG5vdCBmaW5kIGRvY2tlci1jb21w
b3NlLnltbAogICAgZ290byA6ZXJyb3IKKQplY2hvICAgICAgIEZvdW5kOiAhQ09NUE9TRV9GSUxF
IQoKZWNoby4KZWNobyBbMy80XSBTdGFydGluZyBzZXJ2aWNlcy4uLgplY2hvLgpjZCAvZCAiJVND
UklQVF9ESVIlIgpkb2NrZXItY29tcG9zZSB1cCAtZAoKaWYgJWVycm9yTGV2ZWwlIG5lcSAwICgK
ICAgIGVjaG8gW0VSUk9SXSBGYWlsZWQgdG8gc3RhcnQgc2VydmljZXMuCiAgICBnb3RvIDplcnJv
cgopCgplY2hvLgplY2hvIFs0LzRdIFdhaXRpbmcgZm9yIHNlcnZpY2VzLi4uCnRpbWVvdXQgL3Qg
NSAvbm9icmVhayA+bnVsCgplY2hvLgplY2hvID09PT09PT09PT09PT09PT09PT09PT09PT09PT09
PT09PT09PT09PT09PT09PT09PT0KZWNobyAgICAgICAgICAgICAgIENMQVVESUEgU0VSVklDRVMg
U1RBUlRFRAplY2hvID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09
PT09PT0KZWNoby4KZWNobyAgIENsYXVkaWEgQ29kZXI6ICBodHRwOi8vbG9jYWxob3N0OjMwMDAK
ZWNobyAgIEdpdExhYjogICAgICAgICBodHRwOi8vbG9jYWxob3N0Ojg5MjkKZWNobyAgIG44bjog
ICAgICAgICAgICBodHRwOi8vbG9jYWxob3N0OjU2NzgKZWNobyAgIFdoaXNwZXI6ICAgICAgICBo
dHRwOi8vbG9jYWxob3N0OjgwMDAKZWNoby4KCmVjaG8gT3BlbmluZyBicm93c2VyLi4uCnRpbWVv
dXQgL3QgMiAvbm9icmVhayA+bnVsCnN0YXJ0ICIiICJodHRwOi8vbG9jYWxob3N0OjMwMDAiCmVj
aG8uCmdvdG8gOmVuZAoKOmVycm9yCmVjaG8uCmVjaG8gRmFpbGVkIHRvIHN0YXJ0IHNlcnZpY2Vz
LgplY2hvLgoKOmVuZAplY2hvIFByZXNzIGFueSBrZXkgdG8gZXhpdC4uLgpwYXVzZSA+bnVsCmVu
ZGxvY2FsCg==
"@

# -----------------------------------------------------------------------------
# stop-claudia.bat
# -----------------------------------------------------------------------------
"stop-claudia.bat" = @"
QGVjaG8gb2ZmCnNldGxvY2FsIGVuYWJsZWRlbGF5ZWRleHBhbnNpb24KCnRpdGxlIENsYXVkaWEg
LSBTdG9wcGluZyBTZXJ2aWNlcwoKZWNoby4KZWNobyA9PT09PT09PT09PT09PT09PT09PT09PT09
PT09PT09PT09PT09PT09PT09PT09PT09CmVjaG8gICAgICAgICAgICAgICAgIFNUT1BQSU5HIENM
QVVESUEgU0VSVklDRVMKZWNobyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09
PT09PT09PT09PT09CmVjaG8uCgplY2hvIENoZWNraW5nIERvY2tlciBzdGF0dXMuLi4KZG9ja2Vy
IGluZm8gPm51bCAyPiYxCmlmICVlcnJvckxldmVsJSBuZXEgMCAoCiAgICBlY2hvIFtXQVJOSU5H
XSBEb2NrZXIgaXMgbm90IHJ1bm5pbmcuCiAgICBnb3RvIDplbmQKKQoKc2V0ICJTQ1JJUFRfRElS
PSV+ZHAwIgpzZXQgIkNPTVBPU0VfRklMRT0lU0NSSVBUX0RJUiVkb2NrZXItY29tcG9zZS55bWwi
CgppZiBleGlzdCAiIUNPTVBPU0VfRklMRSEiICgKICAgIGNkIC9kICIlU0NSSVBUX0RJUiUiCiAg
ICBkb2NrZXItY29tcG9zZSBkb3duCikgZWxzZSAoCiAgICBkb2NrZXIgc3RvcCBjbGF1ZGlhLWNv
ZGVyIGNsYXVkaWEtZ2l0bGFiIGNsYXVkaWEtbjhuIGNsYXVkaWEtd2hpc3BlciBjbGF1ZGlhLXBv
c3RncmVzIGNsYXVkaWEtcmVkaXMgMj5udWwKKQoKZWNoby4KZWNobyA9PT09PT09PT09PT09PT09
PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CmVjaG8gICAgICAgICAgICAgICBDTEFV
RElBIFNFUlZJQ0VTIFNUT1BQRUQKZWNobyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09
PT09PT09PT09PT09PT09PT09CmVjaG8uCgo6ZW5kCmVjaG8gUHJlc3MgYW55IGtleSB0byBleGl0
Li4uCnBhdXNlID5udWwKZW5kbG9jYWwK
"@

# -----------------------------------------------------------------------------
# status.bat
# -----------------------------------------------------------------------------
"status.bat" = @"
QGVjaG8gb2ZmCnNldGxvY2FsIGVuYWJsZWRlbGF5ZWRleHBhbnNpb24KCnRpdGxlIENsYXVkaWEg
LSBTZXJ2aWNlIFN0YXR1cwoKZWNoby4KZWNobyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09
PT09PT09PT09PT09PT09PT09PT09CmVjaG8gICAgICAgICAgICAgICAgIENMQVVESUEgU0VSVklD
RSBTVEFUVVMKZWNobyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09
PT09PT09CmVjaG8uCgpkb2NrZXIgaW5mbyA+bnVsIDI+JjEKaWYgJWVycm9yTGV2ZWwlIG5lcSAw
ICgKICAgIGVjaG8gW0VSUk9SXSBEb2NrZXIgaXMgbm90IHJ1bm5pbmcuCiAgICBnb3RvIDplbmQK
KQoKZWNobyBEb2NrZXI6IFJ1bm5pbmcKZWNoby4KZWNobyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0t
LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tCmVjaG8gICAgICAgICAgICAgICAg
ICBDT05UQUlORVIgU1RBVFVTCmVjaG8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0t
LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLQplY2hvLgpkb2NrZXIgcHMgLS1mb3JtYXQgInRhYmxl
IHt7Lk5hbWVzfX1cdHt7LlN0YXR1c319XHR7ey5Qb3J0c319IiAtLWZpbHRlciAibmFtZT1jbGF1
ZGlhLSIKZWNoby4KZWNobyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0t
LS0tLS0tLS0tLS0tLS0tLS0tCmVjaG8gICAgICAgICAgICAgICAgICAgIFNFUlZJQ0UgVVJMUwpl
Y2hvIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0t
LS0tLS0KZWNoby4KZWNobyAgIENsYXVkaWEgQ29kZXI6ICBodHRwOi8vbG9jYWxob3N0OjMwMDAK
ZWNobyAgIEdpdExhYjogICAgICAgICBodHRwOi8vbG9jYWxob3N0Ojg5MjkKZWNobyAgIG44bjog
ICAgICAgICAgICBodHRwOi8vbG9jYWxob3N0OjU2NzgKZWNobyAgIFdoaXNwZXI6ICAgICAgICBo
dHRwOi8vbG9jYWxob3N0OjgwMDAKZWNoby4KCjplbmQKZWNobyBQcmVzcyBhbnkga2V5IHRvIGV4
aXQuLi4KcGF1c2UgPm51bAplbmRsb2NhbAo=
"@

# -----------------------------------------------------------------------------
# uninstall.bat
# -----------------------------------------------------------------------------
"uninstall.bat" = @"
QGVjaG8gb2ZmCnNldGxvY2FsIGVuYWJsZWRlbGF5ZWRleHBhbnNpb24KCnRpdGxlIENsYXVkaWEg
VW5pbnN0YWxsZXIKCmVjaG8uCmVjaG8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09
PT09PT09PT09PT09PT09PQplY2hvICAgICAgICAgICAgICAgICBDTEFVRElBIFVOSU5TVEFMTEVS
CmVjaG8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQpl
Y2hvLgplY2hvIFRoaXMgd2lsbCByZW1vdmUgQ2xhdWRpYSBmcm9tIHlvdXIgc3lzdGVtLgplY2hv
LgoKc2V0IC9wICJDT05GSVJNPUF3cmUgeW91IHN1cmU/ICh5ZXMvbm8pOiAiCmlmIC9pIG5vdCAi
IUNPNVRZJSEKI PT9PSJ5ZXMiICgKICAgIGVjaG8gVW5pbnN0YWxsYXRpb24gY2FuY2VsbGVkLgog
ICAgZ290byA6ZW5kCikKCmVjaG8uCmVjaG8gU3RvcHBpbmcgc2VydmljZXMuLi4Kc2V0ICJTQ1JJ
UFRfRElSPSV+ZHAwIgpjZCAvZCAiJVNDUklQVF9ESVIlIgpkb2NrZXItY29tcG9zZSBkb3duIDI+
bnVsCgplY2hvLgplY2hvIFJlbW92aW5nIGNvbnRhaW5lcnMuLi4KZG9ja2VyIHJtIC1mIGNsYXVk
aWEtY29kZXIgY2xhdWRpYS1naXRsYWIgY2xhdWRpYS1uOG4gY2xhdWRpYS13aGlzcGVyIGNsYXVk
aWEtcG9zdGdyZXMgY2xhdWRpYS1yZWRpcyAyPm51bAoKZWNoby4Kc2V0IC9wICJSRU1PVkVfVk9M
VU1FUz1SZW1vdmUgZGF0YSB2b2x1bWVzPyAoeWVzL25vKTogIgppZiAvaSAiIVJFTU9WRV9WT0xV
TUVTISIgPT0gInllcyIgKAogICAgZG9ja2VyLWNvbXBvc2UgZG93biAtdiAyPm51bAogICAgZG9j
a2VyIHZvbHVtZSBybSBjbGF1ZGlhLWRhdGEgZ2l0bGFiLWNvbmZpZyBnaXRsYWItbG9ncyBnaXRs
YWItZGF0YSBwb3N0Z3Jlcy1kYXRhIHJlZGlzLWRhdGEgbjhuLWRhdGEgd2hpc3Blci1tb2RlbHMg
Mj5udWwKKQoKZWNoby4KZWNobyBVbmluc3RhbGxhdGlvbiBjb21wbGV0ZS4KZWNoby4KCjplbmQK
ZWNobyBQcmVzcyBhbnkga2V5IHRvIGV4aXQuLi4KcGF1c2UgPm51bAplbmRsb2NhbAo=
"@

}

# =============================================================================
# CONFIGURATION
# =============================================================================
$Script:Config = @{
    ProductName = "Claudia Coder"
    Version = "1.0.0"
    Publisher = "Claudia Coder Team"
    Website = "https://github.com/claudia-coder/claudia-coder"
    InstallDir = $InstallDir
    RegistryPath = "HKLM:\SOFTWARE\ClaudiaCoder"
    UninstallPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\ClaudiaCoder"
}

# =============================================================================
# CONSOLE STYLING
# =============================================================================
function Show-Banner {
    $banner = @"

   _____ _                 _ _          _____          _
  / ____| |               | (_)        / ____|        | |
 | |    | | __ _ _   _  __| |_  __ _  | |     ___   __| | ___ _ __
 | |    | |/ _`` | | | |/ _`` | |/ _`` | | |    / _ \ / _`` |/ _ \ '__|
 | |____| | (_| | |_| | (_| | | (_| | | |___| (_) | (_| |  __/ |
  \_____|_|\__,_|\__,_|\__,_|_|\__,_|  \_____\___/ \__,_|\___|_|

                 Windows Installer v$($Script:Config.Version)

"@
    Write-Host $banner -ForegroundColor Cyan
}

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Magenta
    Write-Host " $Message" -ForegroundColor Magenta
    Write-Host ("=" * 60) -ForegroundColor Magenta
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Show-ProgressBar {
    param(
        [string]$Activity,
        [int]$PercentComplete
    )
    $width = 40
    $completed = [math]::Round($width * $PercentComplete / 100)
    $remaining = $width - $completed
    $bar = "[" + ("#" * $completed) + ("-" * $remaining) + "]"
    Write-Host "`r$Activity $bar $PercentComplete%" -NoNewline
}

# =============================================================================
# FILE EXTRACTION
# =============================================================================
function ConvertFrom-Base64File {
    param(
        [string]$Base64Content,
        [string]$OutputPath
    )

    try {
        $bytes = [System.Convert]::FromBase64String($Base64Content)
        [System.IO.File]::WriteAllBytes($OutputPath, $bytes)
        return $true
    }
    catch {
        Write-ErrorMsg "Failed to decode file: $($_.Exception.Message)"
        return $false
    }
}

function Expand-EmbeddedFiles {
    Write-Step "Extracting Installation Files"

    $totalFiles = $Script:EmbeddedFiles.Count
    $currentFile = 0

    foreach ($fileName in $Script:EmbeddedFiles.Keys) {
        $currentFile++
        $percent = [math]::Round(($currentFile / $totalFiles) * 100)
        Show-ProgressBar -Activity "Extracting" -PercentComplete $percent

        $outputPath = Join-Path $Script:Config.InstallDir $fileName

        # Ensure directory exists
        $dir = Split-Path $outputPath -Parent
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }

        $base64Content = $Script:EmbeddedFiles[$fileName]

        if (-not (ConvertFrom-Base64File -Base64Content $base64Content -OutputPath $outputPath)) {
            throw "Failed to extract: $fileName"
        }
    }

    Write-Host ""
    Write-Success "Extracted $totalFiles files"
}

# =============================================================================
# PREREQUISITES CHECK
# =============================================================================
function Test-Prerequisites {
    Write-Step "Checking Prerequisites"

    $issues = @()

    # Windows version
    $osVersion = [System.Environment]::OSVersion.Version
    if ($osVersion.Major -lt 10) {
        $issues += "Windows 10 or later is required"
    }
    else {
        Write-Success "Windows version: $($osVersion.Major).$($osVersion.Minor)"
    }

    # 64-bit check
    if (-not [Environment]::Is64BitOperatingSystem) {
        $issues += "64-bit Windows is required"
    }
    else {
        Write-Success "Architecture: 64-bit"
    }

    # RAM check
    $totalRAM = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)
    if ($totalRAM -lt 8) {
        $issues += "At least 8 GB RAM recommended (found: ${totalRAM} GB)"
    }
    else {
        Write-Success "RAM: ${totalRAM} GB"
    }

    # Disk space
    $drive = Split-Path $Script:Config.InstallDir -Qualifier
    $freeSpace = [math]::Round((Get-PSDrive -Name $drive.TrimEnd(':')).Free / 1GB)
    if ($freeSpace -lt 20) {
        Write-Warn "Low disk space: ${freeSpace} GB free (50 GB recommended)"
    }
    else {
        Write-Success "Free disk space: ${freeSpace} GB"
    }

    # Docker check
    $dockerInstalled = $null -ne (Get-Command "docker" -ErrorAction SilentlyContinue)
    if ($dockerInstalled) {
        $dockerVersion = docker --version 2>&1
        Write-Success "Docker: $dockerVersion"
    }
    else {
        Write-Warn "Docker Desktop is not installed (will be prompted to download)"
    }

    if ($issues.Count -gt 0) {
        Write-Host ""
        Write-ErrorMsg "Installation cannot continue due to the following issues:"
        foreach ($issue in $issues) {
            Write-Host "  - $issue" -ForegroundColor Red
        }
        return $false
    }

    return $true
}

# =============================================================================
# INSTALLATION
# =============================================================================
function Install-ClaudiaCoder {
    Write-Step "Installing Claudia Coder"

    # Create installation directory
    if (-not (Test-Path $Script:Config.InstallDir)) {
        Write-Info "Creating installation directory: $($Script:Config.InstallDir)"
        New-Item -ItemType Directory -Path $Script:Config.InstallDir -Force | Out-Null
    }

    # Create subdirectories
    $subDirs = @("data", "logs", "config", "scripts")
    foreach ($dir in $subDirs) {
        $path = Join-Path $Script:Config.InstallDir $dir
        if (-not (Test-Path $path)) {
            New-Item -ItemType Directory -Path $path -Force | Out-Null
        }
    }

    # Extract embedded files
    Expand-EmbeddedFiles

    # Copy .env.template to .env if needed
    $envFile = Join-Path $Script:Config.InstallDir ".env"
    $templateFile = Join-Path $Script:Config.InstallDir ".env.template"
    if (-not (Test-Path $envFile) -and (Test-Path $templateFile)) {
        Copy-Item $templateFile $envFile
        Write-Info "Created .env from template"
    }

    Write-Success "Files installed to: $($Script:Config.InstallDir)"
}

function Add-WindowsShortcuts {
    Write-Step "Creating Shortcuts"

    $shell = New-Object -ComObject WScript.Shell

    # Desktop shortcuts
    $desktopPath = [Environment]::GetFolderPath("Desktop")

    # Start shortcut
    $startLnk = Join-Path $desktopPath "Claudia Coder.lnk"
    $shortcut = $shell.CreateShortcut($startLnk)
    $shortcut.TargetPath = Join-Path $Script:Config.InstallDir "start-claudia.bat"
    $shortcut.WorkingDirectory = $Script:Config.InstallDir
    $shortcut.Description = "Start Claudia Coder"
    $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,137"
    $shortcut.Save()
    Write-Info "Created: Claudia Coder.lnk"

    # Stop shortcut
    $stopLnk = Join-Path $desktopPath "Stop Claudia.lnk"
    $shortcut = $shell.CreateShortcut($stopLnk)
    $shortcut.TargetPath = Join-Path $Script:Config.InstallDir "stop-claudia.bat"
    $shortcut.WorkingDirectory = $Script:Config.InstallDir
    $shortcut.Description = "Stop Claudia Services"
    $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,27"
    $shortcut.Save()
    Write-Info "Created: Stop Claudia.lnk"

    # Start Menu shortcuts
    $startMenuPath = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Claudia Coder"
    if (-not (Test-Path $startMenuPath)) {
        New-Item -ItemType Directory -Path $startMenuPath -Force | Out-Null
    }

    # Start Menu - Main shortcut
    $shortcut = $shell.CreateShortcut((Join-Path $startMenuPath "Claudia Coder.lnk"))
    $shortcut.TargetPath = Join-Path $Script:Config.InstallDir "start-claudia.bat"
    $shortcut.WorkingDirectory = $Script:Config.InstallDir
    $shortcut.Description = "Start Claudia Coder"
    $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,137"
    $shortcut.Save()

    # Start Menu - Status shortcut
    $shortcut = $shell.CreateShortcut((Join-Path $startMenuPath "Service Status.lnk"))
    $shortcut.TargetPath = Join-Path $Script:Config.InstallDir "status.bat"
    $shortcut.WorkingDirectory = $Script:Config.InstallDir
    $shortcut.Description = "Check Claudia Service Status"
    $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,166"
    $shortcut.Save()

    # Start Menu - Stop shortcut
    $shortcut = $shell.CreateShortcut((Join-Path $startMenuPath "Stop Services.lnk"))
    $shortcut.TargetPath = Join-Path $Script:Config.InstallDir "stop-claudia.bat"
    $shortcut.WorkingDirectory = $Script:Config.InstallDir
    $shortcut.Description = "Stop Claudia Services"
    $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,27"
    $shortcut.Save()

    # Start Menu - Uninstall shortcut
    $shortcut = $shell.CreateShortcut((Join-Path $startMenuPath "Uninstall.lnk"))
    $shortcut.TargetPath = Join-Path $Script:Config.InstallDir "uninstall.bat"
    $shortcut.WorkingDirectory = $Script:Config.InstallDir
    $shortcut.Description = "Uninstall Claudia Coder"
    $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,32"
    $shortcut.Save()

    # URL shortcuts
    "[InternetShortcut]`nURL=http://localhost:3000" | Out-File (Join-Path $startMenuPath "Web Interface.url") -Encoding ASCII

    Write-Success "Created desktop and Start Menu shortcuts"
}

function Add-RegistryEntries {
    Write-Step "Adding Registry Entries"

    # Create registry key
    if (-not (Test-Path $Script:Config.RegistryPath)) {
        New-Item -Path $Script:Config.RegistryPath -Force | Out-Null
    }

    # Set installation info
    Set-ItemProperty -Path $Script:Config.RegistryPath -Name "InstallPath" -Value $Script:Config.InstallDir
    Set-ItemProperty -Path $Script:Config.RegistryPath -Name "Version" -Value $Script:Config.Version

    # Add/Remove Programs entry
    if (-not (Test-Path $Script:Config.UninstallPath)) {
        New-Item -Path $Script:Config.UninstallPath -Force | Out-Null
    }

    $uninstallBat = Join-Path $Script:Config.InstallDir "uninstall.bat"

    Set-ItemProperty -Path $Script:Config.UninstallPath -Name "DisplayName" -Value $Script:Config.ProductName
    Set-ItemProperty -Path $Script:Config.UninstallPath -Name "DisplayVersion" -Value $Script:Config.Version
    Set-ItemProperty -Path $Script:Config.UninstallPath -Name "Publisher" -Value $Script:Config.Publisher
    Set-ItemProperty -Path $Script:Config.UninstallPath -Name "InstallLocation" -Value $Script:Config.InstallDir
    Set-ItemProperty -Path $Script:Config.UninstallPath -Name "UninstallString" -Value "cmd.exe /c `"$uninstallBat`""
    Set-ItemProperty -Path $Script:Config.UninstallPath -Name "URLInfoAbout" -Value $Script:Config.Website
    Set-ItemProperty -Path $Script:Config.UninstallPath -Name "NoModify" -Value 1 -Type DWord
    Set-ItemProperty -Path $Script:Config.UninstallPath -Name "NoRepair" -Value 1 -Type DWord

    # Calculate installed size
    $size = (Get-ChildItem $Script:Config.InstallDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1KB
    Set-ItemProperty -Path $Script:Config.UninstallPath -Name "EstimatedSize" -Value ([int]$size) -Type DWord

    Write-Success "Added Windows registry entries"
}

function Show-CompletionMessage {
    Write-Step "Installation Complete!"

    $message = @"

Claudia Coder has been installed successfully!

Installation Directory: $($Script:Config.InstallDir)

Services (after starting):
  - Claudia Coder:  http://localhost:3000
  - GitLab:         http://localhost:8929
  - n8n:            http://localhost:5678
  - Whisper:        http://localhost:8000

Quick Start:
  1. Double-click 'Claudia Coder' on your desktop
  2. Wait for Docker containers to start
  3. Open http://localhost:3000 in your browser

Default Credentials:
  - GitLab: root / (see gitlab-initial-password.txt)
  - n8n: admin / claudia

Need help? Visit: $($Script:Config.Website)

"@
    Write-Host $message -ForegroundColor White
}

function Test-DockerAndPrompt {
    Write-Step "Checking Docker Desktop"

    $dockerInstalled = $null -ne (Get-Command "docker" -ErrorAction SilentlyContinue)

    if (-not $dockerInstalled) {
        Write-Warn "Docker Desktop is not installed."
        Write-Host ""
        Write-Host "Docker Desktop is required to run Claudia Coder." -ForegroundColor Yellow
        Write-Host "Would you like to download it now?" -ForegroundColor Yellow
        Write-Host ""

        if (-not $Silent) {
            $response = Read-Host "Open Docker Desktop download page? (Y/n)"
            if ($response -ne "n" -and $response -ne "N") {
                Start-Process "https://www.docker.com/products/docker-desktop"
                Write-Host ""
                Write-Info "Please install Docker Desktop, then run start-claudia.bat"
            }
        }
    }
    else {
        Write-Success "Docker Desktop is installed"

        # Check if Docker is running
        try {
            docker info 2>&1 | Out-Null
            Write-Success "Docker daemon is running"
        }
        catch {
            Write-Warn "Docker Desktop is installed but not running"
            Write-Info "Please start Docker Desktop, then run start-claudia.bat"
        }
    }
}

# =============================================================================
# UNINSTALLATION
# =============================================================================
function Uninstall-ClaudiaCoder {
    Write-Step "Uninstalling Claudia Coder"

    # Stop services
    $stopBat = Join-Path $Script:Config.InstallDir "stop-claudia.bat"
    if (Test-Path $stopBat) {
        Write-Info "Stopping services..."
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $stopBat -Wait -NoNewWindow
    }

    # Remove shortcuts
    Write-Info "Removing shortcuts..."
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    Remove-Item (Join-Path $desktopPath "Claudia Coder.lnk") -Force -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $desktopPath "Stop Claudia.lnk") -Force -ErrorAction SilentlyContinue

    $startMenuPath = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Claudia Coder"
    if (Test-Path $startMenuPath) {
        Remove-Item $startMenuPath -Recurse -Force -ErrorAction SilentlyContinue
    }

    # Remove registry entries
    Write-Info "Removing registry entries..."
    Remove-Item $Script:Config.RegistryPath -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $Script:Config.UninstallPath -Recurse -Force -ErrorAction SilentlyContinue

    # Ask about data
    if (-not $Silent) {
        Write-Host ""
        $response = Read-Host "Remove installation directory and all data? (y/N)"
        if ($response -eq "y" -or $response -eq "Y") {
            Write-Info "Removing installation directory..."
            Remove-Item $Script:Config.InstallDir -Recurse -Force -ErrorAction SilentlyContinue
        }
        else {
            Write-Info "Installation directory preserved at: $($Script:Config.InstallDir)"
        }

        Write-Host ""
        $response = Read-Host "Remove Docker volumes? (y/N)"
        if ($response -eq "y" -or $response -eq "Y") {
            Write-Info "Removing Docker volumes..."
            docker volume rm claudia-data gitlab-config gitlab-logs gitlab-data postgres-data redis-data n8n-data whisper-models 2>$null
        }
    }
    else {
        Remove-Item $Script:Config.InstallDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    Write-Success "Claudia Coder has been uninstalled"
}

# =============================================================================
# MAIN ENTRY POINT
# =============================================================================
function Start-Installer {
    Clear-Host
    Show-Banner

    # Check for admin
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-ErrorMsg "This installer must be run as Administrator."
        Write-Info "Right-click PowerShell and select 'Run as Administrator'"
        if (-not $Silent) {
            Read-Host "Press Enter to exit"
        }
        exit 1
    }

    Write-Success "Running with Administrator privileges"
    Write-Info "Install directory: $($Script:Config.InstallDir)"

    if ($Uninstall) {
        Uninstall-ClaudiaCoder
        return
    }

    # User confirmation
    if (-not $Silent) {
        Write-Host ""
        Write-Host "This will install Claudia Coder to: $($Script:Config.InstallDir)" -ForegroundColor White
        Write-Host ""
        $response = Read-Host "Continue with installation? (Y/n)"
        if ($response -eq "n" -or $response -eq "N") {
            Write-Info "Installation cancelled"
            return
        }
    }

    try {
        # Prerequisites
        if (-not (Test-Prerequisites)) {
            if (-not $Silent) {
                Read-Host "Press Enter to exit"
            }
            exit 1
        }

        # Installation
        Install-ClaudiaCoder
        Add-WindowsShortcuts
        Add-RegistryEntries

        # Docker check
        Test-DockerAndPrompt

        # Complete
        Show-CompletionMessage

        # Offer to start
        if (-not $Silent) {
            Write-Host ""
            $response = Read-Host "Start Claudia Coder now? (Y/n)"
            if ($response -ne "n" -and $response -ne "N") {
                $startBat = Join-Path $Script:Config.InstallDir "start-claudia.bat"
                Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $startBat
            }
        }
    }
    catch {
        Write-ErrorMsg "Installation failed: $($_.Exception.Message)"
        Write-ErrorMsg $_.ScriptStackTrace
        if (-not $Silent) {
            Read-Host "Press Enter to exit"
        }
        exit 1
    }
}

# Run the installer
Start-Installer
