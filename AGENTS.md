# YDS Agent Notes

## Windows / macOS 공통 Git 동기화 규칙

Windows와 macOS에서 같은 YDS 저장소를 이어서 작업할 때 아래 규칙을 공통으로 따른다.
기본 통합 브랜치는 `integration/yds-windows-mac` 이다. Production(`main`) 배포·환경·DB와 섞지 않는다.

### 동기화 전 확인

1. 현재 브랜치가 `integration/yds-windows-mac` 인지 확인한다.
2. `git status`로 미커밋 변경사항을 확인한다.
3. `git fetch origin`으로 원격 상태를 갱신한다.
4. 로컬 HEAD와 `origin/integration/yds-windows-mac` 의 ahead/behind 관계를 확인한다.
5. 윈도우(또는 상대 기기)에서 Push한 최신 작업이 로컬에 반영됐는지 확인한다.

### 업데이트 조건 (Fast-forward only)

1. 로컬 HEAD가 원격 브랜치의 조상(ancestor)이고 Fast-forward가 가능할 때만 업데이트한다.
2. 가능하면 `git pull --ff-only origin integration/yds-windows-mac` 방식으로만 진행한다.
3. Fast-forward가 불가능하거나 충돌 가능성이 있으면 **즉시 중단하고 보고**한다. 임의로 해결하지 않는다.
4. 업데이트 후 HEAD, 반영 커밋 수, `git status`를 확인한다. 로컬 HEAD와 origin tip이 일치하는지 본다.

### 금지 사항

- `git reset --hard` 금지
- `git clean` 금지
- Rebase 금지
- 일반 Merge 금지 (FF-only가 아닐 때)
- 강제 Push (`--force` / `--force-with-lease`로 덮어쓰기) 금지
- 사용자가 요청하지 않은 Commit / Push / Deploy 금지
- Production 배포 금지
- Production DB 쓰기·환경변수 변경 금지
- Supabase / Firebase 운영 설정 변경 금지
- 기존 미커밋 작업·산출물을 덮어쓰거나 삭제하지 않는다
- 충돌·예상치 못한 변경이 있으면 중단하고 보고한다

### 작업 원칙

- 한쪽에만 있는 로컬 커밋이 있으면 pull 전에 상태를 보고하고, FF가 아니면 진행하지 않는다.
- 조사만 하는 단계에서는 파일 수정·Checkout·Merge를 하지 않는다.
- 동기화 목적은 Windows와 macOS 작업 트리를 같은 브랜치 tip에 맞추는 것이다. 상대 기기 작업을 보존한다.
