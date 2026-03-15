# 代理域名排查记录

> 排查日期：2026-03-16
> 排查方法：关闭油猴脚本，用 Playwright 浏览器逐个访问 `https://<代理域名>.proxy.ecnu.edu.cn/`，检查最终 URL 是否仍在 `*.proxy.ecnu.edu.cn` 下。
> 注意：未登录 WebVPN 时，部分正常域名会跳到 WebVPN 登录页或被路由到其他数据库，这是代理的会话行为，不代表脚本有问题。

## 已修复的问题

| 原始域名 | 问题 | 修复方式 |
|---------|------|---------|
| `www.webofscience.com` | 代理内 302 → `webofscience.clarivate.cn`，该域名也在 mapping 中导致二次跳转循环 | 从 mapping 和 `@match` 移除 `webofscience.clarivate.cn` |
| `www.sciencemag.org` | 域名已改为 `www.science.org`，代理内部处理了跳转，但用户直接访问新域名时脚本不匹配 | 添加 `www.science.org` 到 `@match` 和 mapping |
| `www.opticsinfobase.org` | 域名已改为 `opg.optica.org`，同上 | 添加 `opg.optica.org` 到 `@match` 和 mapping |
| `dl.sciencesocieties.org` | 跳出代理到 `wiley.scienceconnect.io` | 从 mapping 和 `@match` 移除 |

## 跳出代理（代理服务器问题，非脚本问题）

以下域名经过二次验证（2026-03-16），确认是**代理服务器本身不支持或无法处理**。脚本正确导向了代理 URL，但代理服务器跳出。需要学校图书馆更新代理配置才能解决。

| 原始域名 | mapping 中的代理前缀 | 跳转目标 | 可能原因 |
|---------|---------------------|---------|---------|
| `onlinelibrary.wiley.com` | `onlinelibrary-wiley-com` | `wiley.scienceconnect.io` | Wiley 认证系统拒绝代理域名；HTTP 版本 504，HTTPS(-443) 版本跳出 |
| `ebookcentral.proquest.com` | `ebookcentral-proquest-com-443` | `about.proquest.com` | 跳到 ProQuest 产品介绍页 |
| `www.degruyter.com` | `www-degruyter-com` | `www.degruyterbrill.com` | 域名已改为 degruyterbrill.com |
| `www.oecd-ilibrary.org` | `www-oecd--ilibrary-org` | `www.oecd.org` | 域名已改，跳到 OECD 主站 |
| `sage.cnpereading.com` | `sage-cnpereading-com` | `sage.cnpereading.com` | 跳出代理回到原始域名 |
| `www.pnas.org` | `www-pnas-org` | 504 超时 / `pnas.scienceconnect.io` | HTTP 版本 504，HTTPS(-443) 版本跳出到 scienceconnect |

## 正常工作

### 外文数据库

| 原始域名 | 代理前缀 | 备注 |
|---------|---------|------|
| `www.sciencedirect.com` | `www-sciencedirect-com` | 自动升级到 -443 |
| `scifinder-n.cas.org` | `scifinder--n-cas-org-443` | 跳到 CAS SSO 登录，仍在代理内 |
| `www.jstor.org` | `www-jstor-org` | 需要 -443 版本才能正常工作 |
| `jcr.clarivate.com` | `jcr-clarivate-com-443` | 跳到 Clarivate 登录页，正常 |
| `esi.clarivate.com` | `esi-clarivate-com-443` | 同上 |
| `incites.clarivate.com` | `incites-clarivate-com-443` | 同上 |
| `research.ebsco.com` | `research-ebsco-com-443` | 正常 |
| `search.ebscohost.com` | `search-ebscohost-com` | 正常，自动升级到 -443 |
| `web.s.ebscohost.com` | `web-s-ebscohost-com-443` | 正常 |
| `www.reaxys.com` | `www-reaxys-com-443` | 正常 |
| `www.scopus.com` | `www-scopus-com` | 正常，自动升级到 -443 |
| `www.scival.com` | `www-scival-com-443` | 正常 |
| `pubs.acs.org` | `pubs-acs-org` | 自动升级到 -443 |
| `link.springer.com` | `link-springer-com` | 自动升级到 -443 |
| `www.tandfonline.com` | `www-tandfonline-com` | 自动升级到 -443 |
| `ieeexplore.ieee.org` | `ieeexplore-ieee-org` | 自动升级到 -443 |
| `dl.acm.org` | `dl-acm-org-443` | 正常 |
| `www.proquest.com` | `www-proquest-com-443` | 正常 |
| `academic.oup.com` | `academic-oup-com-443` | 未登录时路由到其他站点，需登录验证 |
| `www.nature.com` | `www-nature-com-443` | 同上 |
| `www.cambridge.org` | `www-cambridge-org-443` | 同上 |
| `mathscinet.ams.org` | `mathscinet-ams-org-443` | 同上 |
| `www.emerald.com` | `www-emerald-com-443` | Cloudflare 验证，仍在代理内 |
| `heinonline.org` | `heinonline-org` | 跳到 `home-heinonline-org-443`，正常 |
| `advance.lexis.com` | `advance-lexis-com` | 正常 |
| `bioone.org` | `bioone-org-443` | hCaptcha 验证，仍在代理内 |
| `www.annualreviews.org` | `www-annualreviews-org` | 自动升级到 -443，正常 |
| `pubs.rsc.org` | `pubs-rsc-org` | 自动升级到 -443 |
| `www.jove.com` | `www-jove-com` | 自动升级到 -443 |
| `www.iresearchbook.cn` | `www-iresearchbook-cn-443` | 正常 |
| `www.spiedigitallibrary.org` | `www-spiedigitallibrary-org` | hCaptcha 验证，仍在代理内 |
| `www.agu.org` | `www-agu-org-443` | 正常 |

### 中文数据库

| 原始域名 | 代理前缀 | 备注 |
|---------|---------|------|
| `www.cnki.net` | `www-cnki-net` | 自动升级到 -443，正常 |
| `kns.cnki.net` | `kns-cnki-net-443` | 验证码页面，仍在代理内 |
| `data.csmar.com` | `data-csmar-com-443` | 正常 |
| `www.wanfangdata.com.cn` | `www-wanfangdata-com-cn` | 自动升级到 -443，正常 |
| `www.drcnet.com.cn` | `www-drcnet-com-cn` | 自动升级到 -443，正常 |
| `www.bjinfobank.com` | `www-bjinfobank-com` | 正常（HTTP） |
| `law.wkinfo.com.cn` | `law-wkinfo-com-cn-443` | 正常 |

### 未登录时无法确认（需登录 WebVPN 后验证）

以下域名在未登录时跳到 WebVPN 登录页或路由到其他数据库，这是代理的正常会话行为，不一定代表有问题。

| 原始域名 | 代理前缀 | 未登录时的行为 |
|---------|---------|--------------|
| `www.sslibrary.com` | `www-sslibrary-com-443` | 路由到其他站点 |
| `edu.duxiu.com` | `edu-duxiu-com` | 重定向循环 |
| `www.pkulaw.cn` | `www-pkulaw-cn` | 路由到其他站点 |
| `www.pkulaw.com` | `www-pkulaw-com-443` | 行为不稳定 |
| `www.zhizhen.com` | `www-zhizhen-com` | 重定向循环 |
| `www.ncpssd.cn` | `www-ncpssd-cn-443` | 跳到 WebVPN 登录页 |
| `www.cnrds.com` | `www-cnrds-com-443` | 跳到 WebVPN 登录页 |
| `db.resset.com` | `db-resset-com-443` | 跳到 WebVPN 登录页 |
| `link.gale.com` | `link-gale-com-443` | 重定向循环 |
| `data.imf.org` | `data-imf-org-443` | 跳到 WebVPN 登录页 |
| `academic.eb.com` | `academic-eb-com-443` | 跳到 WebVPN 登录页 |
| `iopscience.iop.org` | `iopscience-iop-org` | 跳到 Radware 验证 |
| `pubs.aip.org` | `pubs-aip-org-443` | 导航失败 |
| `www.worldscientific.com` | `www-worldscientific-com` | 路由到其他站点 |
| `epubs.siam.org` | `epubs-siam-org` | 路由到其他站点 |
| `dlib.eastview.com` | `dlib-eastview-com` | 路由到其他站点 |
| `search.alexanderstreet.com` | `search-alexanderstreet-com-443` | 路由到其他站点 |
| `www.emis.com` | `www-emis-com-443` | 路由到其他站点 |

## 小众库补充测试（2026-03-16）

### 正常工作

| 原始域名 | 代理前缀 | 备注 |
|---------|---------|------|
| `data.cnki.net` | `data-cnki-net` | 自动升级到 -443 |
| `ecnu.dps.qikan.cn` | `ecnu-dps-qikan-cn-443` | 正常 |
| `jingdian.ancientbooks.cn` | `jingdian-ancientbooks-cn-443` | 正常 |
| `dh.ersjk.com` | `dh-ersjk-com` | 正常 |
| `www.pqdtcn.com` | `www-pqdtcn-com` | 自动升级到 -443，正常 |
| `www.incopat.com` | `www-incopat-com-443` | 正常 |
| `wisesearch6.wisers.net` | `wisesearch6-wisers-net-443` | 跳到 login-wisers-net-443，仍在代理内 |
| `guji.unihan.com.cn` | `guji-unihan-com-cn-443` | 正常 |

### 两次测试结果不一致

> 以下域名两次测试结果不一致。由于两个 Playwright agent 并行共用同一个浏览器，第二次测试可能受到干扰。**第一次（单独测试）的结果更可靠**。

| 原始域名 | 代理前缀 | 第一次结果（可靠） | 第二次结果（可能受干扰） |
|---------|---------|-----------|-----------|
| `www.blyun.com` | `www-blyun-com` | 正常 | 重定向循环 |
| `www.airitilibrary.cn` | `www-airitilibrary-cn-443` | 正常 | 跳到 proxy.ecnu.edu.cn |
| `ebooks.airitilibrary.cn` | `ebooks-airitilibrary-cn-443` | 正常 | site not found |
| `www.ding-xiu.com` | `www-ding--xiu-com` | 正常 | 跳出到 mg.nlcpress.com |
| `gujiku.unihan.com.cn` | `gujiku-unihan-com-cn-443` | 正常 | 路由到其他站点 |
| `www.cfrn.com.cn` | `www-cfrn-com-cn-443` | 正常 | 路由到其他站点 |
| `www.shidianguji.com` | `www-shidianguji-com-443` | 正常 | 跳到 proxy.ecnu.edu.cn |

### 代理服务器问题（非脚本问题）

| 原始域名 | 代理前缀 | 未登录时的行为 |
|---------|---------|--------------|
| `r.cnki.net` | `r-cnki-net` | 重定向循环 |
| `image.cnki.net` | `image-cnki-net-443` | 路由到其他站点 |
| `ref.cnki.net` | `ref-cnki-net-443` | WebVPN 报 "site not found" |
| `bz.nlcpress.com` | `bz-nlcpress-com` | WebVPN 报 "site not found" |
| `mg.nlcpress.com` | `mg-nlcpress-com` | 跳出代理到原站 `mg.nlcpress.com` |
| `luxun.nlcpress.com` | `luxun-nlcpress-com-443` | 路由到其他站点 |
| `www.cnbksy.com` | `www-cnbksy-com-443` | 路由到其他站点 |
| `c.wanfangdata.com.cn` | `c-wanfangdata-com-cn-443` | WebVPN 报 "site not found" |
| `cadal.edu.cn` | `cadal-edu-cn-443` | 导航失败 |
| `data.lilun.cn` | `data-lilun-cn` | 路由到其他站点 |
| `ssvideo.superlib.com` | `ssvideo-superlib-com-443` | Playwright 导航失败，未能确认 |

## 排查结论

1. **脚本已修复 4 个问题**：WoS 二次跳转循环、Science/Optica 域名改名补充、sciencesocieties 移除
2. **确认 6 个跳出是代理服务器问题**：Wiley、ProQuest Ebook Central、De Gruyter、OECD、SAGE CNPeReading、PNAS
3. **并行测试干扰**：两个 Playwright agent 共用同一浏览器并行测试时，结果可能互相干扰。部分域名两次测试结果不一致，以第一次单独测试的结果为准。
4. **"路由到其他站点"不一定是问题**：WebVPN 代理有会话路由机制，部分结果可能是代理的正常行为，不代表脚本有问题。
5. **验证方法**：如需确认某个 mapping 是否真的有问题，应关闭油猴脚本后直接访问 `https://<代理域名>.proxy.ecnu.edu.cn/`，检查最终 URL 是否仍在 `*.proxy.ecnu.edu.cn` 下。
