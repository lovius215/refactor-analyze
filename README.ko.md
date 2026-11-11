# 레거시 시스템 리팩토링 분석 AI 워크스페이스 (`@loviusc/refactor-analyze`)

[![npm version](https://img.shields.io/npm/v/@loviusc/refactor-analyze.svg)](https://www.npmjs.com/package/@loviusc/refactor-analyze)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> Gemini, Claude, GPT/Codex 등 AI 에이전트를 지원하며, 환각(Hallucination) 없이 코드 및 DB 근거에 기반하여 구형 시스템을 역분석하고 리팩토링 문서를 산출하는 CLI 워크스페이스입니다.

<p align="center">
  <b>🌐 언어 선택 (Languages):</b>
  <a href="./README.en.md"><b>English</b></a> |
  <a href="./README.zh-TW.md"><b>繁體中文</b></a> |
  <a href="./README.zh-CN.md"><b>简体中文</b></a> |
  <a href="./README.ja.md"><b>日本語</b></a> |
  <a href="./README.ko.md"><b>한국어</b></a>
</p>

---

## 핵심 설계 및 6대 안전장치

`@loviusc/refactor-analyze`는 **분석 워크스페이스와 대상 레거시 시스템 디렉터리를 분리**하여 기존 프로젝트를 오염시키지 않으며, 다음 6가지 핵심 메커니즘을 제공합니다:

1. **🛡️ AI 환각 금지 철칙 (Zero-Hallucination — 근거 없는 작성 엄금)**:
   - 모든 비즈니스 로직, 계산식, 상태 전이, 데이터 흐름 및 SQL은 반드시 소스코드 파일 경로와 라인 번호(예: `` `OrderService.java#L45-L92` ``) 또는 실제 DB 스키마 근거를 명시해야 합니다.
   - 의미가 불분명한 컬럼 정의나 주석 없는 상태 코드(Magic Numbers)는 임의로 추측하지 않고 자동으로 `project/<번호>/backlog.md`에 기록하며, 확인 후 `reanalyze`를 통해 반영합니다.
2. **⚡ 토큰 절약형 2단계 분석 아키텍처**:
   - 1단계(`init` / `rai`)에서는 시스템 개요(**모바일 APP / 데스크톱 애플리케이션 / 웹 시스템** 판정 및 범위 설명)와 카테고리별 번호 목록(`project/index.md`)만 산출합니다.
   - 2단계(`analyze <번호>` / `raa <번호>`)에서는 번호별로 진입점부터 추적하며 공통 모듈을 `project/shared/`로 분리하여 중복 토큰 소모를 방지합니다.
3. **🗄️ 배스천 호스트(SSH Jump Host) 지원 실제 DB 스키마 스캔 (`scandb` / `ras`)**:
   - `project/system/db-connection.md`(`.gitignore`로 자동 보호)에 DB 제품, 경로, 계정, 비밀번호 및 SSH 점프 호스트를 입력한 뒤 `scandb`를 실행하면 읽기 전용으로 모든 테이블, 컬럼, 주석, Trigger를 수집하여 `project/system/db/<table>.md`로 분할 생성합니다.
4. **🧾 SQL 전용 문서 (`sql.md`) 및 데드코드 관리 (`dead-code.md`)**:
   - `sql.md`에 원본 SQL 및 동적 조건과 최적화 제안을 정리하고, `dead-code.md`에는 **Git 브랜치, Git Commit Hash, 파일 이름, 라인 번호, 판정 사유 및 관련 코드**를 필수 기록합니다.
5. **🔄 현황(As-Is)과 리팩토링 개선 제안(To-Be Notes) 분리**:
   - 구형 시스템의 기술 부채(N+1 쿼리, 트랜잭션 누락 등)가 신규 시스템에 그대로 복사되는 것을 방지합니다.
6. **🤝 자동 Git Commit, Remote Sync 및 충돌 해결 지원 (`commit` / `rac`)**:
   - 확인 후 `project/index.md` 상태를 갱신하고 로컬 Git 커밋 및 원격 동기화를 수행하며, 충돌 발생 시 병합을 지원한 후 다시 커밋 및 동기화합니다.

---

## 설치, 업데이트 및 삭제 (macOS / Linux / Windows)

모든 스크립트는 실행 전 **`npm` 설치 여부를 자동으로 확인**합니다:

- **macOS / Linux (`.sh`)**:
  ```bash
  ./scripts/install.sh     # 설치
  ./scripts/update.sh      # 최신 버전 업데이트
  ./scripts/uninstall.sh   # 삭제
  ```
- **Windows (`.bat`)**:
  ```bat
  scripts\install.bat      :: 설치
  scripts\update.bat       :: 최신 버전 업데이트
  scripts\uninstall.bat    :: 삭제
  ```

---

## 명령어 요약표

| 단계 | CLI 명령어 | AI 대화 명령어 | 약어 | 설명 |
|---|---|---|---|---|
| **1. 초기화 및 시스템 개요** | `refactor-analyze init [--full] [--lang ...]` | `refactor:init [경로]` | `rai` | 워크스페이스 및 Git 생성, 언어 확정, 대상 경로 및 원격 정렬 여부 확인, `project/system/` 및 번호 목록 `project/index.md` 산출. |
| **2. DB 컬럼 스캔** | `refactor-analyze scandb` | `refactor:scandb` | `ras` | `db-connection.md`(점프 호스트 지원)를 기반으로 실제 DB에서 모든 테이블/컬럼/Trigger를 스캔하여 `db-schema.md` 및 `db/<table>.md` 생성. |
| **3. 번호별 심층 분석** | `refactor-analyze analyze <번호>` | `refactor:analyze <번호>` | `raa` | `project/<번호>/` 폴더를 생성하고 비즈니스 로직, **화면 조작 동작 및 유효성 검증(`ui-behavior.md`)**, 데이터 흐름, SQL, 의존성, 데드코드, 복잡도를 분석하며 **`backlog.md` 자동 생성**. |
| **4. 번호별 재분석** | `refactor-analyze reanalyze <번호>` | `refactor:reanalyze <번호>` | `rar` | `backlog.md`에 보충된 설명이나 코드 변경을 반영하여 **재분석**하고 `project/<번호>/` 내 모든 문서 갱신. |
| **5. 0-Token 출처 및 드리프트 검증** | `refactor-analyze verify [번호]` | `refactor:verify [번호]` | `rav` | 로컬 0-Token으로 `#Lx-Ly` 소스 파일 및 라인 번호의 실재 여부를 검증하고 대상 시스템의 Git 커밋 변경에 따른 라인 이동을 감지. |
| **6. 확정 커밋 및 동기화** | `refactor-analyze commit [번호]` | `refactor:commit [번호]` | `rac` | `verify` 통과 후 `project/index.md` 상태 갱신, 자동 Git 커밋 및 안전한 원격 sync 실행(충돌 발생 시 파일 손상 없이 안전하게 중지). |
| **7. PDF 내보내기** | `refactor-analyze pdf [대상] [--merge] [--output ...]` *(또는 `md2pdf`)* | `refactor:pdf [대상]` | `rap` | **0-Token 로컬 변환**: 지정한 `.md` 파일, 번호 폴더(예: `001`) 또는 `project/` 전체를 `.pdf`로 변환(`--merge`로 단일 PDF 병합 지원). |
| **8. 기존 프로젝트 업데이트** | `refactor-analyze upgrade [--dry-run]` *(또는 `update`)* | `refactor:upgrade` | `rau` | 기존 분석 항목의 언어 설정과 분석 내용을 유지한 채 규칙과 누락된 템플릿을 최신 버전으로 업데이트. |
| **9. 상태 및 점검** | `refactor-analyze status` / `check` / `doctor` | - | - | 진행 상태 확인 및 필수 파일 점검. |

---

## 💡 실전 사용 예시: 레거시 주문 시스템 리버스 엔지니어링 (Example Walkthrough)

다음은 10년 된 Java/Spring/JSP 주문 시스템(`legacy-shop`)을 표준 리팩토링 문서로 역공학 분석하는 실전 예시입니다:

### Step 1. 독립 분석 워크스페이스 생성
```bash
mkdir shop-refactor-workspace && cd shop-refactor-workspace
refactor-analyze init --full --lang ko
```

### Step 2. AI를 통한 시스템 전체 파악 (`rai`)
AI 에이전트(Gemini / Claude / Cursor / Antigravity) 대화창에 입력:
```text
rai /Users/dev/projects/legacy-shop
```
AI가 대상 시스템의 Git 브랜치와 버전을 확인하고 다음을 생성합니다:
- `project/system/overview.md`: **웹 시스템 (Web)** (Spring MVC + MyBatis + JSP + MySQL) 판정.
- `project/index.md`: 업무 분류별 기능/API 목록:
  ```markdown
  ## 분류: 주문 관리 (Order Management)
  | 번호 | 기능 또는 API | 프로그램 위치 (진입점) | 복잡도 | 현재 상태 |
  |---|---|---|---|---|
  | `001` | 체크아웃 및 주문 생성 | `src/controller/OrderController.java#createOrder` | 고 | 대기 |
  | `002` | 주문 상세 및 상태 조회 | `src/controller/OrderController.java#getOrderDetail` | 저 | 대기 |
  ```

### Step 3. 실제 데이터베이스 및 코드 테이블 읽기 전용 스캔 (`ras`)
`project/system/db-connection.md`(`.gitignore` 보호)에 접속 정보와 코드 테이블(`Code Tables: SYS_CODE`)을 설정하고 실행:
```bash
refactor-analyze scandb
```
출력:
- `project/system/db/orders.md`, `order_items.md`: 컬럼 타입, PK/FK, 인덱스, 주석.
- `project/system/db/_routines.md`: 저장 프로시저 `SP_CALC_DISCOUNT`의 전체 SQL 소스.
- `project/system/code-dictionary.md`: `SYS_CODE` 사전 값(`01=임시저장, 02=결제완료, 03=출고완료`).

### Step 4. 번호 001 비즈니스 로직 심층 분석 (`raa 001`)
```bash
refactor-analyze analyze 001
# 또는 AI 대화창에 입력:
raa 001
```
AI가 `project/001/` 디렉터리에 환각 없이 8개의 표준 문서를 생성합니다:
1. **`analysis.md`**: 진입점 인자, 암시적 Session 의존성(`Session["CURRENT_DEPT_ID"]`), As-Is 현황 vs To-Be 리팩토링 제안(반복문 내 DB 조회의 N+1 기술 부채 식별).
2. **`business-logic.md`**: 소스 라인 번호가 명시된 비즈니스 규칙(`OrderService.java#L85-L112`), 트랜잭션 범위, 인수 테스트 시나리오(Given/When/Then).
3. **`ui-behavior.md`**: 드롭다운 데이터 출처, 화면 vs 백엔드 유효성 검증 매트릭스(화면에서 최대 99개를 제한하지만 서버 측에서 검증이 누락된 취약점 발견).
4. **`data-flow.md`**: Request → Service → `orders` 테이블 쓰기 흐름.
5. **`sql.md`**: `OrderMapper.xml`의 SQL문 및 동적 `<if>` 태그 분석.
6. **`dependencies.md`**: 호출 체인 및 공통 모듈 참조.
7. **`dead-code.md`**: 주석 처리된 이전 계산 로직.
8. **`backlog.md`**: 코드 내 불분명한 매직 넘버(`FLG_03 = 'K'`) 자동 추출.

### Step 5. 0-Token 출처 검증 및 드리프트 감지 (`rav 001`)
```bash
refactor-analyze verify 001
```
로컬에서 인용된 라인 번호의 실재 여부를 0 Token으로 검증하고 대상 코드의 변경 사항을 감지합니다.

### Step 6. 확정 커밋, CRUD 자동 집계 및 원격 동기화 (`rac 001`)
```bash
refactor-analyze commit 001
```
- `orders` 테이블의 CRUD 작업을 `project/system/domain-flows.md`에 자동 집계.
- `project/index.md` 상태를 `완료`로 업데이트하고 Git 커밋 및 원격 sync 실행.

### Step 7. 원클릭 PDF 내보내기 (`rap 001`)
```bash
refactor-analyze pdf 001 --merge
```
표지, 목차, 코드 하이라이트가 포함된 단일 PDF(`project/001/001-merged.pdf`)를 로컬에서 즉시 렌더링!
