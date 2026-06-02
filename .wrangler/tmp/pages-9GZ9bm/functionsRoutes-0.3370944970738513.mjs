import { onRequestPost as __api_auth_login_js_onRequestPost } from "D:\\Project\\fund-tracker\\functions\\api\\auth\\login.js"
import { onRequestGet as __api_auth_me_js_onRequestGet } from "D:\\Project\\fund-tracker\\functions\\api\\auth\\me.js"
import { onRequestPost as __api_auth_me_js_onRequestPost } from "D:\\Project\\fund-tracker\\functions\\api\\auth\\me.js"
import { onRequestPost as __api_auth_register_js_onRequestPost } from "D:\\Project\\fund-tracker\\functions\\api\\auth\\register.js"
import { onRequestGet as __api_daily_profits_js_onRequestGet } from "D:\\Project\\fund-tracker\\functions\\api\\daily-profits.js"
import { onRequestGet as __api_fund_industry_js_onRequestGet } from "D:\\Project\\fund-tracker\\functions\\api\\fund-industry.js"
import { onRequestDelete as __api_funds_js_onRequestDelete } from "D:\\Project\\fund-tracker\\functions\\api\\funds.js"
import { onRequestGet as __api_funds_js_onRequestGet } from "D:\\Project\\fund-tracker\\functions\\api\\funds.js"
import { onRequestPost as __api_funds_js_onRequestPost } from "D:\\Project\\fund-tracker\\functions\\api\\funds.js"
import { onRequestGet as __api_market_js_onRequestGet } from "D:\\Project\\fund-tracker\\functions\\api\\market.js"
import { onRequestPost as __api_ocr_js_onRequestPost } from "D:\\Project\\fund-tracker\\functions\\api\\ocr.js"
import { onRequestGet as __api_search_js_onRequestGet } from "D:\\Project\\fund-tracker\\functions\\api\\search.js"
import { onRequestGet as __api_stock_quotes_js_onRequestGet } from "D:\\Project\\fund-tracker\\functions\\api\\stock-quotes.js"
import { onRequestPost as __api_sync_js_onRequestPost } from "D:\\Project\\fund-tracker\\functions\\api\\sync.js"
import { onRequestDelete as __api_transactions_js_onRequestDelete } from "D:\\Project\\fund-tracker\\functions\\api\\transactions.js"
import { onRequestGet as __api_transactions_js_onRequestGet } from "D:\\Project\\fund-tracker\\functions\\api\\transactions.js"
import { onRequestPost as __api_transactions_js_onRequestPost } from "D:\\Project\\fund-tracker\\functions\\api\\transactions.js"

export const routes = [
    {
      routePath: "/api/auth/login",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_login_js_onRequestPost],
    },
  {
      routePath: "/api/auth/me",
      mountPath: "/api/auth",
      method: "GET",
      middlewares: [],
      modules: [__api_auth_me_js_onRequestGet],
    },
  {
      routePath: "/api/auth/me",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_me_js_onRequestPost],
    },
  {
      routePath: "/api/auth/register",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_register_js_onRequestPost],
    },
  {
      routePath: "/api/daily-profits",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_daily_profits_js_onRequestGet],
    },
  {
      routePath: "/api/fund-industry",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_fund_industry_js_onRequestGet],
    },
  {
      routePath: "/api/funds",
      mountPath: "/api",
      method: "DELETE",
      middlewares: [],
      modules: [__api_funds_js_onRequestDelete],
    },
  {
      routePath: "/api/funds",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_funds_js_onRequestGet],
    },
  {
      routePath: "/api/funds",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_funds_js_onRequestPost],
    },
  {
      routePath: "/api/market",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_market_js_onRequestGet],
    },
  {
      routePath: "/api/ocr",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_ocr_js_onRequestPost],
    },
  {
      routePath: "/api/search",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_search_js_onRequestGet],
    },
  {
      routePath: "/api/stock-quotes",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_stock_quotes_js_onRequestGet],
    },
  {
      routePath: "/api/sync",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_sync_js_onRequestPost],
    },
  {
      routePath: "/api/transactions",
      mountPath: "/api",
      method: "DELETE",
      middlewares: [],
      modules: [__api_transactions_js_onRequestDelete],
    },
  {
      routePath: "/api/transactions",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_transactions_js_onRequestGet],
    },
  {
      routePath: "/api/transactions",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_transactions_js_onRequestPost],
    },
  ]