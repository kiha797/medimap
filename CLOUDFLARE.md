# 메디맵 Cloudflare 배포

Workers Builds에서 다음 명령을 설정합니다.

- 빌드 명령: `npm run build`
- 배포 명령: `npm run deploy:cloudflare`

배포 스크립트는 `cloudflare-d1.json`에 지정한 `medimap-db`의 미적용 SQL 마이그레이션을 먼저 실행하고 Worker를 배포합니다. 기존 테이블을 삭제하거나 거래처 데이터를 초기화하지 않습니다. 빌드용 API 토큰에 해당 계정의 D1 편집 권한이 필요합니다.

`medimap-db`는 기존 Sites 데이터베이스와 별도입니다. 이 저장소에는 실제 API 인증키, 전국 기관 데이터, 거래처 데이터가 포함되지 않습니다. `HIRA_SERVICE_KEY`는 Cloudflare Worker의 암호화된 환경변수(Secret)로 등록합니다.

거래처 업로드와 데이터 관리는 작업 비밀번호로 확인합니다. Cloudflare Worker의 설정 → 변수 및 비밀에서 `ADMIN_PASSWORD`를 Secret으로 등록하세요. 비밀번호 원문은 GitHub 소스에 포함하지 않습니다.
