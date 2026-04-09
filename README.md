# KIS Codex Trade Dashboard

한국투자증권 해외주식 계좌를 감시해서 보유 종목이 목표 수익률에 도달하면 자동 매도 주문을 넣고, 미국 우량주/트렌드 테마/섹터 데이터를 `Codex CLI`로 분석해 UI에 보여주는 대시보드입니다.

## 핵심 특징

- 한국투자증권 해외주식 잔고 조회 후 목표 수익률 기반 자동 매도
- `Codex CLI` 기반 시장 분석
- 미국 우량주 Top 10, 트렌드 강한 분야 Top 10, 섹터 Top 10 표시
- 서버와 프론트를 분리한 모듈형 구조

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
PORT=8787
VITE_API_BASE_URL=http://localhost:8787
```

## 실행

```bash
npm install
npm run dev
```

- 서버: `http://localhost:8787`
- 프론트: `http://localhost:5173`

프로덕션 빌드:

```bash
npm run build
npm run start
```

## 자동매도 동작 방식

- 한국투자증권 해외주식 잔고를 주기적으로 조회합니다.
- 수익률이 목표값 이상이면 보유 수량 전량에 대해 매도 주문을 넣습니다.
- 현재 구현은 미국주식 매도 시 `지정가(ORD_DVSN=00)` 로 현재가 기준 주문을 넣습니다.
- 같은 종목에 대해 24시간 내 이미 제출한 자동매도 주문이 있으면 재주문을 막습니다.

## 주의

- 반드시 `demo` 환경에서 먼저 확인한 뒤 실전(`real`)로 전환하세요.
- 실전 계좌에선 실제 주문이 발생합니다.
- 자동매도는 시장가가 아니라 현재가 기준 지정가 주문이므로 급변동 구간에서는 즉시 체결되지 않을 수 있습니다.
- 시장 데이터는 `Yahoo Finance` 비공식 패키지를 사용하므로 장애나 지연이 생길 수 있습니다.

## 참고

- 한국투자증권 공식 샘플: https://github.com/koreainvestment/open-trading-api
- Codex CLI 로그인 안내: https://help.openai.com/en/articles/11381614-codex-codex-andsign-in-with-chatgpt
