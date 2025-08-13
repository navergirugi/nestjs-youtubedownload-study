!macro preInit
   ; 설치 시작 전, 기존에 실행 중일 수 있는 모든 관련 프로세스를 강제로 종료합니다.
   ; 이는 "cannot be closed" 오류를 원천적으로 방지하는 가장 확실한 방법입니다.
   ; /F: 강제 종료, /T: 자식 프로세스까지 함께 종료
   ExecWait 'taskkill /F /IM "SM YouTube Downloader.exe" /T'
   ExecWait 'taskkill /F /IM "yt-dlp.exe"'
   ; 이 매크로는 설치가 시작되기 전에 실행됩니다.
   ; 이전 버전을 먼저 자동으로, 그리고 조용히 "완전 제거"하여 설치 오류를 원천적으로 방지합니다.

   ; 프로세스 종료 후 파일 잠금이 해제될 시간을 벌기 위해 잠시 대기합니다.
   Sleep 500

   ; 2단계: 레지스트리
   ; 레지스트리에서 이전 버전의 제거 프로그램(Uninstaller) 경로를 읽어옵니다.
   ; ${APP_ID}는 package.json의 appId 값으로 자동 교체됩니다.
   ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "UninstallString"

   ; 제거 프로그램이 실제로 존재하는지 확인하고, 없으면 이 단계를 건너뜁니다.
   IfFileExists "$R0" "" +3
    ; 제거 프로그램을 조용히(/S) 실행합니다. 사용자에게는 아무것도 보이지 않습니다.
    ; 제거 프로그램을 조용히(/S) 실행하고 끝날 때까지 기다립니다.
    ExecWait '"$R0" /S _?=$INSTDIR'
    ; 제거 후 시스템이 파일 잠금을 해제할 시간을 벌기 위해 잠시 대기합니다.
    Sleep 500
    ; 완전 제거 후 시스템이 정리될 시간을 충분히 주기 위해 다시 대기합니다.
    Sleep 1000
!macroend