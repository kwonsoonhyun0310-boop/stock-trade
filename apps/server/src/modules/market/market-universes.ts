export interface AssetSeed {
  symbol: string;
  name: string;
  nameKo: string;
  category: string;
  descriptionKo: string;
}

export interface IndustryGroupSeed {
  symbol: string;
  name: string;
  nameKo: string;
  category: string;
  descriptionKo: string;
  members: string[];
}

const asset = (
  symbol: string,
  name: string,
  nameKo: string,
  category: string,
  descriptionKo: string
): AssetSeed => ({
  symbol,
  name,
  nameKo,
  category,
  descriptionKo
});

const industryGroup = (
  symbol: string,
  name: string,
  nameKo: string,
  category: string,
  descriptionKo: string,
  members: string[]
): IndustryGroupSeed => ({
  symbol,
  name,
  nameKo,
  category,
  descriptionKo,
  members
});

export const BLUE_CHIP_UNIVERSE: AssetSeed[] = [
  asset("MSFT", "Microsoft", "마이크로소프트", "Platform", "윈도우와 오피스, 클라우드 서비스를 만드는 큰 소프트웨어 회사"),
  asset("AAPL", "Apple", "애플", "Consumer Tech", "아이폰과 아이패드, 맥을 만드는 대표 소비자 기술 회사"),
  asset("NVDA", "NVIDIA", "엔비디아", "Semiconductors", "AI 계산에 많이 쓰이는 그래픽 칩을 만드는 반도체 회사"),
  asset("AMZN", "Amazon", "아마존", "Cloud / Retail", "온라인 쇼핑몰과 AWS 클라우드 사업을 함께 하는 회사"),
  asset("GOOGL", "Alphabet", "알파벳", "Internet Platform", "구글 검색과 유튜브, 광고 사업을 운영하는 회사"),
  asset("META", "Meta Platforms", "메타", "Digital Advertising", "인스타그램과 페이스북을 운영하는 소셜 플랫폼 회사"),
  asset("BRK-B", "Berkshire Hathaway", "버크셔 해서웨이", "Conglomerate", "보험과 철도, 소비재 회사를 많이 가진 투자 지주회사"),
  asset("JPM", "JPMorgan Chase", "JP모건 체이스", "Banking", "대출과 카드, 투자은행 사업을 하는 미국 대형 은행"),
  asset("LLY", "Eli Lilly", "일라이 릴리", "Pharma", "비만과 당뇨 치료제로 유명한 제약 회사"),
  asset("AVGO", "Broadcom", "브로드컴", "Semiconductors", "통신 장비와 데이터센터에 들어가는 칩을 만드는 회사"),
  asset("V", "Visa", "비자", "Payments", "카드 결제가 돌아가도록 연결해 주는 결제 네트워크 회사"),
  asset("MA", "Mastercard", "마스터카드", "Payments", "전 세계 카드 결제망을 운영하는 결제 회사"),
  asset("COST", "Costco", "코스트코", "Consumer Defensive", "회원제로 대형 창고형 매장을 운영하는 유통 회사"),
  asset("XOM", "Exxon Mobil", "엑슨모빌", "Energy", "석유와 가스를 생산하고 판매하는 에너지 회사"),
  asset("PG", "Procter & Gamble", "프록터 앤드 갬블", "Consumer Defensive", "세제와 기저귀, 생활용품을 파는 소비재 회사"),
  asset("JNJ", "Johnson & Johnson", "존슨앤드존슨", "Healthcare", "의약품과 의료 제품을 함께 만드는 헬스케어 회사"),
  asset("HD", "Home Depot", "홈디포", "Retail", "집 수리와 인테리어 용품을 파는 대형 소매 회사"),
  asset("KO", "Coca-Cola", "코카콜라", "Consumer Defensive", "콜라와 음료 브랜드를 전 세계에 파는 음료 회사")
];

export const TRENDING_THEME_UNIVERSE: AssetSeed[] = [
  asset("SMH", "VanEck Semiconductor ETF", "반에크 반도체 ETF", "AI Semiconductors", "반도체 회사 여러 곳을 한 번에 담은 ETF"),
  asset("SOXX", "iShares Semiconductor ETF", "아이셰어즈 반도체 ETF", "AI Semiconductors", "AI와 반도체 대표 종목을 묶어 놓은 ETF"),
  asset("BOTZ", "Global X Robotics & AI ETF", "글로벌X 로봇·AI ETF", "Robotics / AI", "로봇과 인공지능 관련 기업을 모아 둔 ETF"),
  asset("CIBR", "First Trust Cybersecurity ETF", "퍼스트트러스트 사이버보안 ETF", "Cybersecurity", "보안 소프트웨어와 해킹 방어 회사들을 담은 ETF"),
  asset("IGV", "iShares Expanded Tech-Software ETF", "아이셰어즈 소프트웨어 ETF", "Cloud Software", "클라우드와 소프트웨어 회사 중심 ETF"),
  asset("ITA", "iShares US Aerospace & Defense ETF", "아이셰어즈 항공·방산 ETF", "Defense", "항공기와 방위 산업 기업을 담은 ETF"),
  asset("PAVE", "Global X US Infrastructure ETF", "글로벌X 인프라 ETF", "Infrastructure", "도로와 전력, 건설 인프라 기업을 모아 둔 ETF"),
  asset("URA", "Global X Uranium ETF", "글로벌X 우라늄 ETF", "Nuclear", "원자력 연료와 관련 기업을 담은 ETF"),
  asset("AIQ", "Global X Artificial Intelligence ETF", "글로벌X 인공지능 ETF", "AI Applications", "AI 서비스를 만드는 회사들을 담은 ETF"),
  asset("FINX", "Global X FinTech ETF", "글로벌X 핀테크 ETF", "Fintech", "결제와 디지털 금융 회사를 모은 ETF"),
  asset("ICLN", "iShares Global Clean Energy ETF", "아이셰어즈 친환경 에너지 ETF", "Clean Energy", "태양광과 풍력 같은 친환경 에너지 기업 ETF"),
  asset("XBI", "SPDR S&P Biotech ETF", "SPDR 바이오 ETF", "Biotech", "신약과 바이오 기술 회사를 많이 담은 ETF"),
  asset("HACK", "ETFMG Prime Cyber Security ETF", "ETFMG 사이버보안 ETF", "Cybersecurity", "사이버보안 대표 기업을 모아 둔 ETF"),
  asset("XLI", "Industrial Select Sector SPDR", "산업재 섹터 ETF", "Industrials", "기계와 운송, 공장 관련 회사를 담은 산업재 ETF")
];

export const SECTOR_UNIVERSE: AssetSeed[] = [
  asset("XLK", "Technology Select Sector SPDR", "기술 섹터 ETF", "Technology", "미국 대형 기술 회사를 담은 섹터 ETF"),
  asset("XLC", "Communication Services Select Sector SPDR", "커뮤니케이션 섹터 ETF", "Communication Services", "통신과 미디어, 인터넷 플랫폼 회사를 담은 ETF"),
  asset("XLY", "Consumer Discretionary Select Sector SPDR", "소비재 섹터 ETF", "Consumer Discretionary", "자동차와 쇼핑, 여행 같은 소비 회사를 담은 ETF"),
  asset("XLP", "Consumer Staples Select Sector SPDR", "필수소비재 섹터 ETF", "Consumer Staples", "음식과 생활용품 같은 필수 소비 회사를 담은 ETF"),
  asset("XLE", "Energy Select Sector SPDR", "에너지 섹터 ETF", "Energy", "석유와 가스 중심 에너지 회사를 담은 ETF"),
  asset("XLF", "Financial Select Sector SPDR", "금융 섹터 ETF", "Financials", "은행과 보험, 카드 회사를 묶은 ETF"),
  asset("XLV", "Health Care Select Sector SPDR", "헬스케어 섹터 ETF", "Healthcare", "제약과 의료기기 회사를 담은 ETF"),
  asset("XLI", "Industrial Select Sector SPDR", "산업재 섹터 ETF", "Industrials", "기계와 운송, 공장 관련 회사를 담은 산업재 ETF"),
  asset("XLB", "Materials Select Sector SPDR", "소재 섹터 ETF", "Materials", "화학과 금속, 원자재 회사를 담은 ETF"),
  asset("XLRE", "Real Estate Select Sector SPDR", "부동산 섹터 ETF", "Real Estate", "리츠와 부동산 관련 회사를 담은 ETF"),
  asset("XLU", "Utilities Select Sector SPDR", "유틸리티 섹터 ETF", "Utilities", "전기와 가스, 수도 같은 공공서비스 회사를 담은 ETF")
];

export const INDUSTRY_MOMENTUM_UNIVERSE: IndustryGroupSeed[] = [
  industryGroup(
    "AICHIP",
    "AI Chip Designers",
    "AI 반도체 설계",
    "Pure Industry",
    "AI 계산용 칩을 직접 설계하는 회사들을 묶은 분야",
    ["NVDA", "AVGO", "AMD", "MRVL"]
  ),
  industryGroup(
    "CYBER",
    "Cybersecurity",
    "사이버보안",
    "Pure Industry",
    "보안 소프트웨어와 네트워크 방어 솔루션을 만드는 분야",
    ["CRWD", "PANW", "ZS", "FTNT"]
  ),
  industryGroup(
    "CLOUD",
    "Cloud Software",
    "클라우드 소프트웨어",
    "Pure Industry",
    "기업용 클라우드 소프트웨어와 업무 플랫폼을 만드는 분야",
    ["MSFT", "CRM", "NOW", "ADBE"]
  ),
  industryGroup(
    "DEFENSE",
    "Aerospace & Defense",
    "항공우주·방산",
    "Pure Industry",
    "전투기, 미사일, 방위 시스템을 만드는 분야",
    ["RTX", "LMT", "NOC", "GD"]
  ),
  industryGroup(
    "POWER",
    "Grid & Power Equipment",
    "전력망·전력장비",
    "Pure Industry",
    "전기 설비와 전력망 장비를 공급하는 분야",
    ["ETN", "HUBB", "VRT", "EMR"]
  ),
  industryGroup(
    "NUCLEAR",
    "Nuclear Energy",
    "원자력 에너지",
    "Pure Industry",
    "원전 설비와 핵연료 관련 사업을 하는 분야",
    ["CCJ", "BWXT", "CEG", "OKLO"]
  ),
  industryGroup(
    "PAY",
    "Digital Payments",
    "디지털 결제",
    "Pure Industry",
    "카드 결제와 전자결제 네트워크를 운영하는 분야",
    ["V", "MA", "PYPL", "FIS"]
  ),
  industryGroup(
    "WEIGHT",
    "Obesity Therapy",
    "비만 치료제",
    "Pure Industry",
    "비만과 당뇨 치료제 수요를 타는 제약 분야",
    ["LLY", "NVO", "VKTX", "ALT"]
  ),
  industryGroup(
    "INDUST",
    "Industrial Automation",
    "산업 자동화",
    "Pure Industry",
    "공장 자동화와 산업용 제어 장비를 만드는 분야",
    ["ROK", "PH", "HON", "ROP"]
  ),
  industryGroup(
    "ECO",
    "E-Commerce & Ads",
    "전자상거래·광고",
    "Pure Industry",
    "온라인 상거래와 디지털 광고 매출이 큰 플랫폼 분야",
    ["AMZN", "META", "GOOGL", "PDD"]
  ),
  industryGroup(
    "RETAIL",
    "Value Retail",
    "대형 유통",
    "Pure Industry",
    "회원제 창고형 매장과 대형 소매 유통 중심 분야",
    ["COST", "WMT", "TGT", "KR"]
  ),
  industryGroup(
    "TRAVEL",
    "Travel Platforms",
    "여행 플랫폼",
    "Pure Industry",
    "항공 예약과 숙박 예약을 연결하는 온라인 여행 분야",
    ["BKNG", "ABNB", "EXPE", "RCL"]
  )
];

const INDUSTRY_LOOKUP_ASSETS: AssetSeed[] = INDUSTRY_MOMENTUM_UNIVERSE.map((industry) =>
  asset(industry.symbol, industry.name, industry.nameKo, industry.category, industry.descriptionKo)
);

export const MARKET_ASSET_LOOKUP = new Map(
  [
    ...BLUE_CHIP_UNIVERSE,
    ...TRENDING_THEME_UNIVERSE,
    ...SECTOR_UNIVERSE,
    ...INDUSTRY_LOOKUP_ASSETS
  ].map((entry) => [entry.symbol, entry])
);
