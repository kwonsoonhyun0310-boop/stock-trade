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
  tr_cont?: string;
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

export interface KisPsamountOutput {
  tr_crcy_cd?: string;
  ord_psbl_frcr_amt?: string;
  sll_ruse_psbl_amt?: string;
  ovrs_ord_psbl_amt?: string;
  max_ord_psbl_qty?: string;
  echm_af_ord_psbl_amt?: string;
  echm_af_ord_psbl_qty?: string;
  ord_psbl_qty?: string;
  exrt?: string;
  frcr_ord_psbl_amt1?: string;
  ovrs_max_ord_psbl_qty?: string;
}

export interface KisOrderOutput {
  KRX_FWDG_ORD_ORGNO: string;
  ODNO: string;
  ORD_TMD: string;
}

export interface KisOpenOrderRow {
  ord_dt: string;
  ord_gno_brno: string;
  odno: string;
  orgn_odno: string;
  pdno: string;
  sll_buy_dvsn_cd: string;
  rvse_cncl_dvsn_cd: string;
  rjct_rson: string;
  ord_tmd: string;
  tr_crcy_cd: string;
  natn_cd: string;
  ft_ord_qty: string;
  ft_ccld_qty: string;
  nccs_qty: string;
  ft_ord_unpr3: string;
  ft_ccld_unpr3: string;
  ft_ccld_amt3: string;
  ovrs_excg_cd: string;
  loan_type_cd?: string;
  loan_dt?: string;
  usa_amk_exts_rqst_yn?: string;
}

export interface KisOrderHistoryRow {
  ord_dt: string;
  ord_gno_brno: string;
  odno: string;
  orgn_odno: string;
  sll_buy_dvsn_cd: string;
  sll_buy_dvsn_cd_name?: string;
  rvse_cncl_dvsn?: string;
  rvse_cncl_dvsn_name?: string;
  pdno: string;
  prdt_name?: string;
  ft_ord_qty: string;
  ft_ord_unpr3: string;
  ft_ccld_qty: string;
  ft_ccld_unpr3: string;
  ft_ccld_amt3: string;
  nccs_qty: string;
  prcs_stat_name?: string;
  rjct_rson?: string;
  rjct_rson_name?: string;
  ord_tmd: string;
  tr_mket_name?: string;
  tr_crcy_cd?: string;
  tr_natn?: string;
  ovrs_excg_cd?: string;
  tr_natn_name?: string;
  dmst_ord_dt?: string;
  thco_ord_tmd?: string;
  loan_type_cd?: string;
  loan_dt?: string;
  mdia_dvsn_name?: string;
  usa_amk_exts_rqst_yn?: string;
  splt_buy_attr_name?: string;
}
