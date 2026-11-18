# YDS Agent Notes

## Windows 단일 개발 환경

YDS는 **Windows PC 한 대**에서만 개발한다.
맥북과의 교차 작업·브랜치 동기화는 **당분간 중단**한다.
`integration/yds-windows-mac` 동기화 절차는 사용하지 않는다.

Production(`main`) 배포·환경·DB와 일상 개발을 섞지 않는다.
Preview 검증과 Production 배포는 분리한다.

### 작업 전 확인

1. `git status`로 현재 브랜치·미커밋 변경사항을 확인한다.
2. 필요 시 `git fetch origin`으로 원격 상태를 갱신한다. (맥 동기화 목적의 pull은 하지 않는다.)
3. 로컬 HEAD와 추적 원격 브랜치의 ahead/behind을 확인한다.
4. 기존 Windows 미커밋 작업·산출물을 덮어쓰거나 삭제하지 않는다.

### 작업 중 원칙

1. 현재 브랜치와 커밋 이력을 임의로 바꾸지 않는다.
2. 기능 작업은 Windows working tree의 기존 변경을 우선 보존한 채 진행한다.
3. 조사만 하는 단계에서는 불필요한 Checkout·Merge·파일 덮어쓰기를 하지 않는다.
4. 충돌·예상치 못한 변경이 있으면 **즉시 중단하고 보고**한다.

### 작업 완료 시

1. 관련 테스트와 빌드를 확인한다.
2. **Commit / Push는 사용자 승인 후에만** 진행한다.
3. Push가 실패하면 원인을 보고하고, 강제 Push로 해결하지 않는다.
4. Deploy는 사용자가 명시할 때만 진행한다. Preview와 Production을 혼동하지 않는다.

### 금지 사항

- `git reset --hard` 금지
- `git clean`으로 작업 파일 삭제 금지
- Rebase 금지
- 무단 Merge 금지
- 강제 Push (`--force` / `--force-with-lease`) 금지
- 기존 커밋 삭제·히스토리 재작성 금지
- 임의 브랜치 삭제 금지
- 사용자가 요청하지 않은 Commit / Push / Deploy 금지
- Production DB 쓰기·환경변수 변경 금지
- Supabase / Firebase 운영 설정 변경 금지
- 기존 미커밋 Windows 작업을 덮어쓰기·폐기하지 않는다

### (보관) 구 Windows / macOS 동기화 규칙

아래는 과거 교차 기기 동기화용이다. **현재는 사용하지 않는다.**

- 기본 통합 브랜치는 `integration/yds-windows-mac` 였다.
- Fast-forward만 허용 (`git pull --ff-only`), FF 불가 시 중단·보고.
- 목적: Windows와 macOS tip 정렬. 상대 기기 작업 보존.
