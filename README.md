# KIS Codex Trade Dashboard

한국투자증권 미국주식 계좌를 감시해서 목표 수익률에 도달한 보유 종목을 자동 매도하고, 미국 우량주/트렌드 테마/섹터 데이터를 `Codex CLI`로 분석해 UI에 보여주는 대시보드입니다.

## 핵심 특징

- 미국주식 수동 매수/매도 티켓 제공
- 한국투자증권 해외주식 잔고 조회 후 목표 수익률 기반 자동 매도
- `Codex CLI` 기반 시장 분석
- 미국 우량주 Top 10, 트렌드 강한 분야 Top 10, 섹터 Top 10 표시
- 서버와 프론트를 분리한 모듈형 구조
- KIS 토큰 디스크 캐시 및 재사용

## 구조

```text
apps/
  server/   자동매도 엔진, KIS API, Codex CLI 분석, 시장 데이터 API
  web/      React/Vite 대시보드
packages/
  shared/   공통 타입
```

## Codex 사용 방식

이 프로젝트는 OpenAI API 키를 직접 쓰지 않고 로컬 `codex` 명령을 호출합니다.

- 즉, 분석은 현재 머신에 로그인된 `Codex / ChatGPT` 세션을 사용합니다.
- `codex login status` 가 `Logged in using ChatGPT` 여야 합니다.
- 사용자 요청대로 "코덱스 프로 구독제 사용량"을 최대한 그대로 쓰도록 맞춘 구조입니다.

## 현재 동작 범위

- 현재 자동매도 대상은 미국주식만입니다.
- 국내주식은 자동매도 대상으로 조회하지 않습니다.
- 자동매도는 "이 프로그램이 직접 매수한 종목만" 구분하지 않습니다.
- 즉, 계좌에 이미 들고 있던 미국주식도 `watchSymbols` 조건과 수익률 조건에 맞으면 자동매도 대상이 될 수 있습니다.
- 실전에서는 `AUTO_SELL_ENABLED=false` 상태로 먼저 수동 주문 테스트를 끝낸 뒤 켜는 것이 맞습니다.

## 환경 변수

루트에 `.env`를 만들고 아래를 채우면 됩니다.

```env
KIS_ENV=demo
KIS_APP_KEY=
KIS_APP_SECRET=
KIS_BASE_URL=https://openapivts.koreainvestment.com:29443
KIS_ACCOUNT_NO=
KIS_ACCOUNT_PRODUCT_CODE=01
KIS_USD_EXCHANGE_CODES=NASD,NYSE,AMEX
AUTO_SELL_ENABLED=false
AUTO_SELL_TARGET_PERCENT=5
AUTO_SELL_POLL_INTERVAL_MS=45000
CODEX_CLI_PATH=codex
CODEX_MODEL=gpt-5.2-codex
MARKET_CACHE_TTL_MS=900000
PORT=6001
FRONTEND_ORIGIN=http://localhost:5173
VITE_API_BASE_URL=http://localhost:6001
```

계좌 입력 형식:

- `KIS_ACCOUNT_NO`: 계좌 앞 8자리만 입력
- `KIS_ACCOUNT_PRODUCT_CODE`: 뒤 2자리 (`01` 등) 별도 입력
- 예: 계좌가 `12345678-01`이면 `KIS_ACCOUNT_NO=12345678`, `KIS_ACCOUNT_PRODUCT_CODE=01`

## 실행

```bash
npm install
npm run dev
```

- 서버: `http://localhost:6001`
- 프론트: `http://localhost:5173`

개별 실행:

```bash
npm run dev:server
npm run dev:web
```

프로덕션 빌드:

```bash
npm run build
npm run start
```

## UI 사용

- `http://localhost:5173` 에 접속합니다.
- 좌상단 `미국주식 수동 매매` 패널에서 수동 매수/매도 주문을 넣을 수 있습니다.
- `5% 자동매도 설정` 패널에서 자동매도 활성화, 감시 종목, 주기, 목표 수익률을 조정할 수 있습니다.
- `즉시 점검` 버튼은 잔고를 다시 조회합니다.

## 자동매도 동작 방식

- 한국투자증권 해외주식 잔고를 주기적으로 조회합니다.
- 수익률이 목표값 이상이면 보유 수량 전량에 대해 매도 주문을 넣습니다.
- 현재 구현은 미국주식 매도 시 `지정가(ORD_DVSN=00)` 로 현재가 기준 주문을 넣습니다.
- 같은 종목에 대해 24시간 내 이미 제출한 자동매도 주문이 있으면 재주문을 막습니다.
- `watchSymbols`가 비어 있으면 미국 보유 종목 전체를 감시합니다.

## 토큰과 호출 제한

- KIS 접근토큰은 디스크에 캐시되며 유효기간 동안 재사용됩니다.
- 토큰은 매 주문마다 새로 발급하지 않습니다.
- 한국투자증권은 토큰 발급 및 API 호출에 각각 제한이 있습니다.
- 실전 미국 잔고 조회는 중복 호출을 피하기 위해 `NASD` 기준 단일 조회로 동작합니다.

## 주의

- 반드시 `demo` 환경에서 먼저 확인한 뒤 실전(`real`)로 전환하세요.
- 실전 계좌에선 실제 주문이 발생합니다.
- 자동매도는 시장가가 아니라 현재가 기준 지정가 주문이므로 급변동 구간에서는 즉시 체결되지 않을 수 있습니다.
- 시장 데이터는 `Yahoo Finance` 비공식 패키지를 사용하므로 장애나 지연이 생길 수 있습니다.
- 실전에서 `AUTO_SELL_ENABLED=true`로 바꾸면 조건에 맞는 미국 보유 종목이 실제로 매도될 수 있습니다.

## 트러블슈팅

- `EGW00133`: 접근토큰 발급 제한에 걸린 상태입니다. 잠시 후 다시 시도하면 됩니다.
- `초당 거래건수를 초과하였습니다.`: KIS 호출 유량 제한입니다. 잠시 기다린 뒤 다시 조회하세요.
- `해당 앱키는 모의투자용 앱키가 아닙니다.`: `KIS_ENV=demo`인데 실전 앱키를 넣은 경우입니다.
- 홈페이지가 안 뜨면 `http://localhost:5173`으로 접속해야 합니다. `6001`은 API 서버입니다.
- 매매 버튼이 보여도 토큰 발급/호출 제한 상태에선 주문이 실패할 수 있습니다.

## 참고

- 한국투자증권 공식 샘플: https://github.com/koreainvestment/open-trading-api
- Codex CLI 로그인 안내: https://help.openai.com/en/articles/11381614-codex-codex-andsign-in-with-chatgpt
