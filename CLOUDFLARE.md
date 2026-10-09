# 메디맵 Cloudflare 배포

Workers Builds에서 다음 명령을 설정합니다.

- 빌드 명령: `npm run build`
- 배포 명령: `npm run deploy:cloudflare`

배포 스크립트는 `cloudflare-d1.json`에 지정한 `medimap-db`의 미적용 SQL 마이그레이션을 먼저 실행하고 Worker를 배포합니다. 기존 테이블을 삭제하거나 거래처 데이터를 초기화하지 않습니다. 빌드용 API 토큰에 해당 계정의 D1 편집 권한이 필요합니다.

`medimap-db`는 기존 Sites 데이터베이스와 별도입니다. 이 저장소에는 실제 API 인증키, 전국 기관 데이터, 거래처 데이터가 포함되지 않습니다. `HIRA_SERVICE_KEY`는 Cloudflare Worker의 암호화된 환경변수(Secret)로 등록합니다.

현재 관리자 기능은 Sites가 제공하는 ChatGPT 로그인에 연결되어 있습니다. 일반 Cloudflare Worker에서는 이 로그인이 제공되지 않으므로, 거래처 업로드 및 관리자 데이터 연결 기능을 사용하려면 별도의 관리자 인증을 연동해야 합니다. 배포 설정 변경 자체는 인증 기능이나 기존 데이터를 이전하지 않습니다.
