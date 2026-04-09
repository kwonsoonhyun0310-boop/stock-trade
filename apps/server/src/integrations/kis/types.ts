export interface KisTokenResponse {
  access_token: string;
  access_token_token_expired: string;
}

export interface KisApiEnvelope<T> {
  rt_cd: string;
  msg_cd: string;
  msg1: string;
  output?: T;
  output1?: T;
  output2?: T;
  ctx_area_fk200?: string;
  ctx_area_nk200?: string;
}

export interface KisBalanceRow {
  ovrs_pdno: string;
  ovrs_excg_cd: string;
  tr_crcy_cd: string;
  pchs_avg_pric: string;
  ovrs_cblc_qty: string;
  ord_psbl_qty: string;
  frcr_evlu_pfls_amt: string;
  evlu_pfls_rt: string;
  frcr_pchs_amt1: string;
  ovrs_stck_evlu_amt: string;
  now_pric2: string;
}

export interface KisOrderOutput {
  KRX_FWDG_ORD_ORGNO: string;
  ODNO: string;
  ORD_TMD: string;
}
