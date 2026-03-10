// ==UserScript==
// @name         ECNU 文献快速获取 (Auto)
// @namespace    https://github.com/ecnu-literature-quick-access
// @version      1.2.0
// @description  自动将学术网站 URL 跳转到华东师范大学 WebVPN 代理，支持 SSO 自动登录（自动版：匹配所有网站，支持动态识别子域名）
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_notification
// @run-at       document-start
// @license      Apache-2.0
// ==/UserScript==

(function () {
  'use strict';

  // ============================================================
  // §1. Constants & i18n
  // ============================================================

  const PROXY_SUFFIX = '.proxy.ecnu.edu.cn';
  const SSO_LOGIN_HOST = 'sso.ecnu.edu.cn';
  const LIB_LIST_HOST = 'lib.ecnu.edu.cn';
  const LIB_LIST_PATH = '/sjk/list.htm';

  const XOR_KEY = 0x5a;

  const i18n = {
    zh: {
      menuSettings: 'ECNU 文献快速获取 - 设置',
      settingsTitle: '设置 - ECNU 文献快速获取',
      language: '语言',
      credentials: 'SSO 凭据',
      username: '学号 / 工号',
      password: '密码',
      save: '保存',
      saved: '已保存',
      matchMode: '匹配模式',
      matchStatic: '静态匹配（仅映射表中的域名）',
      matchDynamic: '动态匹配（自动识别相关子域名）',
      redirectMode: '跳转模式',
      autoRedirect: '自动跳转',
      manualRedirect: '手动确认',
      redirectBtn: '通过 ECNU 代理访问',
      mappingTitle: '域名映射',
      mappingCount: '当前映射数量',
      addMapping: '添加映射',
      domain: '原始域名',
      proxyDomain: '代理域名',
      add: '添加',
      delete: '删除',
      updateMapping: '更新映射表',
      updateMappingHint: '请前往图书馆数据库列表页触发更新',
      updateBtn: '开始更新映射',
      updating: '正在更新映射...',
      updateDone: '映射更新完成',
      updateProgress: '进度',
      close: '关闭',
      noCredentials: '请先在设置中配置 SSO 账号密码',
      ssoAutoLogin: 'SSO 自动登录',
      ssoAutoLoginOn: '启用',
      ssoAutoLoginOff: '禁用',
      reset: '重置为默认',
      resetConfirm: '确定要重置映射表为默认值吗？',
    },
    en: {
      menuSettings: 'ECNU Literature Quick Access - Settings',
      settingsTitle: 'Settings - ECNU Literature Quick Access',
      language: 'Language',
      credentials: 'SSO Credentials',
      username: 'Student / Staff ID',
      password: 'Password',
      save: 'Save',
      saved: 'Saved',
      matchMode: 'Match Mode',
      matchStatic: 'Static (mapped domains only)',
      matchDynamic: 'Dynamic (auto-detect related subdomains)',
      redirectMode: 'Redirect Mode',
      autoRedirect: 'Auto Redirect',
      manualRedirect: 'Manual Confirm',
      redirectBtn: 'Access via ECNU Proxy',
      mappingTitle: 'Domain Mapping',
      mappingCount: 'Current mapping count',
      addMapping: 'Add Mapping',
      domain: 'Original Domain',
      proxyDomain: 'Proxy Domain',
      add: 'Add',
      delete: 'Delete',
      updateMapping: 'Update Mapping Table',
      updateMappingHint: 'Go to the library database list page to trigger an update',
      updateBtn: 'Start Updating Mapping',
      updating: 'Updating mapping...',
      updateDone: 'Mapping update complete',
      updateProgress: 'Progress',
      close: 'Close',
      noCredentials: 'Please configure SSO credentials in settings first',
      ssoAutoLogin: 'SSO Auto Login',
      ssoAutoLoginOn: 'Enabled',
      ssoAutoLoginOff: 'Disabled',
      reset: 'Reset to Default',
      resetConfirm: 'Are you sure you want to reset the mapping table to default?',
    },
  };

  function t(key) {
    const lang = GM_getValue('lang', 'zh');
    return (i18n[lang] && i18n[lang][key]) || i18n.zh[key] || key;
  }

  // ============================================================
  // §2. Default Domain Mapping
  // ============================================================
  // Format: { originalHost: proxyHost }
  // Crawled from lib.ecnu.edu.cn database detail pages.

  const DEFAULT_MAPPING = {
    // --- Chinese databases ---
    'www.cnki.net': 'www-cnki-net',
    'kns.cnki.net': 'kns-cnki-net-443',
    'data.cnki.net': 'data-cnki-net',
    'r.cnki.net': 'r-cnki-net',
    'image.cnki.net': 'image-cnki-net-443',
    'ref.cnki.net': 'ref-cnki-net-443',
    'data.csmar.com': 'data-csmar-com-443',
    'ecnu.dps.qikan.cn': 'ecnu-dps-qikan-cn-443',
    'www.sslibrary.com': 'www-sslibrary-com-443',
    'edu.duxiu.com': 'edu-duxiu-com',
    'bz.nlcpress.com': 'bz-nlcpress-com',
    'mg.nlcpress.com': 'mg-nlcpress-com',
    'luxun.nlcpress.com': 'luxun-nlcpress-com-443',
    'jingdian.ancientbooks.cn': 'jingdian-ancientbooks-cn-443',
    'www.cnbksy.com': 'www-cnbksy-com-443',
    'www.wanfangdata.com.cn': 'www-wanfangdata-com-cn',
    'c.wanfangdata.com.cn': 'c-wanfangdata-com-cn-443',
    'dh.ersjk.com': 'dh-ersjk-com',
    'www.pkulaw.cn': 'www-pkulaw-cn',
    'www.pkulaw.com': 'www-pkulaw-com-443',
    'cadal.edu.cn': 'cadal-edu-cn-443',
    'data.lilun.cn': 'data-lilun-cn',
    'www.pqdtcn.com': 'www-pqdtcn-com',
    'www.blyun.com': 'www-blyun-com',
    'www.incopat.com': 'www-incopat-com-443',
    'www.airitilibrary.cn': 'www-airitilibrary-cn-443',
    'ebooks.airitilibrary.cn': 'ebooks-airitilibrary-cn-443',
    'www.zhizhen.com': 'www-zhizhen-com',
    'www.ding-xiu.com': 'www-ding--xiu-com',
    'wisesearch6.wisers.net': 'wisesearch6-wisers-net-443',
    'gujiku.unihan.com.cn': 'gujiku-unihan-com-cn-443',
    'guji.unihan.com.cn': 'guji-unihan-com-cn-443',
    'www.ncpssd.cn': 'www-ncpssd-cn-443',
    'www.drcnet.com.cn': 'www-drcnet-com-cn',
    'www.bjinfobank.com': 'www-bjinfobank-com',
    'www.cnrds.com': 'www-cnrds-com-443',
    'law.wkinfo.com.cn': 'law-wkinfo-com-cn-443',
    'www.cfrn.com.cn': 'www-cfrn-com-cn-443',
    'www.shidianguji.com': 'www-shidianguji-com-443',
    'ssvideo.superlib.com': 'ssvideo-superlib-com-443',
    'db.resset.com': 'db-resset-com-443',

    // --- Foreign databases ---
    'www.webofscience.com': 'www-webofscience-com-443',
    'webofscience.clarivate.cn': 'webofscience-clarivate-cn-443',
    'www.sciencedirect.com': 'www-sciencedirect-com',
    'scifinder-n.cas.org': 'scifinder--n-cas-org-443',
    'www.jstor.org': 'www-jstor-org',
    'jcr.clarivate.com': 'jcr-clarivate-com-443',
    'esi.clarivate.com': 'esi-clarivate-com-443',
    'incites.clarivate.com': 'incites-clarivate-com-443',
    'research.ebsco.com': 'research-ebsco-com-443',
    'search.ebscohost.com': 'search-ebscohost-com',
    'web.s.ebscohost.com': 'web-s-ebscohost-com-443',
    'www.reaxys.com': 'www-reaxys-com-443',
    'www.scopus.com': 'www-scopus-com',
    'www.scival.com': 'www-scival-com-443',
    'pubs.acs.org': 'pubs-acs-org',
    'link.springer.com': 'link-springer-com',
    'www.tandfonline.com': 'www-tandfonline-com',
    'onlinelibrary.wiley.com': 'onlinelibrary-wiley-com',
    'ieeexplore.ieee.org': 'ieeexplore-ieee-org',
    'dl.acm.org': 'dl-acm-org-443',
    'www.proquest.com': 'www-proquest-com-443',
    'ebookcentral.proquest.com': 'ebookcentral-proquest-com-443',
    'sage.cnpereading.com': 'sage-cnpereading-com',
    'academic.oup.com': 'academic-oup-com-443',
    'www.nature.com': 'www-nature-com-443',
    'www.sciencemag.org': 'www-sciencemag-org-443',
    'www.cambridge.org': 'www-cambridge-org-443',
    'mathscinet.ams.org': 'mathscinet-ams-org-443',
    'www.emerald.com': 'www-emerald-com-443',
    'heinonline.org': 'heinonline-org',
    'advance.lexis.com': 'advance-lexis-com',
    'link.gale.com': 'link-gale-com-443',
    'data.imf.org': 'data-imf-org-443',
    'www.degruyter.com': 'www-degruyter-com',
    'www.cell.com': 'www-cell-com',
    'bioone.org': 'bioone-org-443',
    'www.annualreviews.org': 'www-annualreviews-org',
    'www.oecd-ilibrary.org': 'www-oecd--ilibrary-org',
    'iopscience.iop.org': 'iopscience-iop-org',
    'pubs.aip.org': 'pubs-aip-org-443',
    'pubs.rsc.org': 'pubs-rsc-org',
    'www.worldscientific.com': 'www-worldscientific-com',
    'epubs.siam.org': 'epubs-siam-org',
    'www.jove.com': 'www-jove-com',
    'dlib.eastview.com': 'dlib-eastview-com',
    'www.iresearchbook.cn': 'www-iresearchbook-cn-443',
    'search.alexanderstreet.com': 'search-alexanderstreet-com-443',
    'www.pnas.org': 'www-pnas-org',
    'academic.eb.com': 'academic-eb-com-443',
    'www.emis.com': 'www-emis-com-443',
    'www.spiedigitallibrary.org': 'www-spiedigitallibrary-org',
    'www.opticsinfobase.org': 'www-opticsinfobase-org',
    'dl.sciencesocieties.org': 'dl-sciencesocieties-org-443',
    'www.agu.org': 'www-agu-org-443',
  };

  // ============================================================
  // §3. Mapping Management
  // ============================================================

  function getMapping() {
    const stored = GM_getValue('domainMapping', null);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (_) { /* fall through */ }
    }
    return Object.assign({}, DEFAULT_MAPPING);
  }

  function saveMapping(mapping) {
    GM_setValue('domainMapping', JSON.stringify(mapping));
  }

  function resetMapping() {
    GM_setValue('domainMapping', JSON.stringify(Object.assign({}, DEFAULT_MAPPING)));
  }

  // Build a reverse index: mainDomain → proxyPrefix for fuzzy matching
  function buildMainDomainIndex(mapping) {
    const index = {};
    for (const host of Object.keys(mapping)) {
      const parts = host.split('.');
      // main domain = last two parts (e.g. cnki.net, springer.com)
      // for .com.cn style, take last three parts
      let main;
      if (parts.length >= 3 && parts[parts.length - 2].length <= 3 && parts[parts.length - 1].length <= 2) {
        main = parts.slice(-3).join('.');
      } else if (parts.length >= 2) {
        main = parts.slice(-2).join('.');
      } else {
        main = host;
      }
      if (!index[main]) {
        index[main] = mapping[host];
      }
    }
    return index;
  }

  // ============================================================
  // §4. Domain Matching
  // ============================================================

  function matchHost(host) {
    if (host.endsWith(PROXY_SUFFIX)) return null;

    const mapping = getMapping();

    // Exact match
    if (mapping[host]) return mapping[host] + PROXY_SUFFIX;

    // In static mode, only exact matches are used
    if (GM_getValue('matchMode', 'dynamic') === 'static') return null;

    // Main-domain fuzzy match (dynamic mode only)
    const mainIndex = buildMainDomainIndex(mapping);
    const parts = host.split('.');
    let main;
    if (parts.length >= 3 && parts[parts.length - 2].length <= 3 && parts[parts.length - 1].length <= 2) {
      main = parts.slice(-3).join('.');
    } else if (parts.length >= 2) {
      main = parts.slice(-2).join('.');
    } else {
      main = host;
    }

    if (mainIndex[main]) {
      // Dynamically convert this host using the URL conversion rule
      const proxyPrefix = domainToProxy(host, mainIndex[main]);
      // Auto-save this new domain into the mapping table for static mode
      mapping[host] = proxyPrefix;
      saveMapping(mapping);
      return proxyPrefix + PROXY_SUFFIX;
    }

    return null;
  }

  // Convert a hostname to proxy prefix using the conversion rule.
  // referenceProxy is used to determine if -443 suffix is needed.
  function domainToProxy(host, referenceProxy) {
    const needs443 = referenceProxy.endsWith('-443');
    const prefix = host.replace(/-/g, '--').replace(/\./g, '-');
    return needs443 ? prefix + '-443' : prefix;
  }

  // ============================================================
  // §5. Credential Encoding / Decoding
  // ============================================================

  function encode(str) {
    return btoa(
      str
        .split('')
        .map(function (c) {
          return String.fromCharCode(c.charCodeAt(0) ^ XOR_KEY);
        })
        .join('')
    );
  }

  function decode(encoded) {
    try {
      return atob(encoded)
        .split('')
        .map(function (c) {
          return String.fromCharCode(c.charCodeAt(0) ^ XOR_KEY);
        })
        .join('');
    } catch (_) {
      return '';
    }
  }

  function getCredentials() {
    const stored = GM_getValue('credentials', null);
    if (!stored) return null;
    try {
      const obj = JSON.parse(stored);
      return { username: decode(obj.u), password: decode(obj.p) };
    } catch (_) {
      return null;
    }
  }

  function saveCredentials(username, password) {
    GM_setValue(
      'credentials',
      JSON.stringify({ u: encode(username), p: encode(password) })
    );
  }

  // ============================================================
  // §6. URL Redirect Logic (runs at document-start)
  // ============================================================

  var host = location.hostname;

  // Always register settings menu command (except on proxy pages)
  if (!host.endsWith(PROXY_SUFFIX)) {
    GM_registerMenuCommand(t('menuSettings'), openSettings);
  }

  // Skip if already on proxy
  if (host.endsWith(PROXY_SUFFIX)) return;
  // SSO page: handle auto-login
  if (host === SSO_LOGIN_HOST) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', handleSSOLogin);
    } else {
      handleSSOLogin();
    }
    return;
  }
  // Library list page: inject update button
  if (host === LIB_LIST_HOST && location.pathname === LIB_LIST_PATH) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectUpdateButton);
    } else {
      injectUpdateButton();
    }
    // Don't return — still register menu commands below
  }

  var proxyHost = matchHost(host);

  if (proxyHost) {
    // First-time setup: if no credentials configured, show settings instead of redirecting
    if (!getCredentials()) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
          openSettings();
        });
      } else {
        openSettings();
      }
    } else {
      var autoRedirect = GM_getValue('autoRedirect', true);
      if (autoRedirect) {
        window.location.replace(
          'https://' + proxyHost + location.pathname + location.search + location.hash
        );
        return; // stop script execution after redirect
      } else {
        // Show floating button after DOM is ready
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', function () {
            showRedirectButton(proxyHost);
          });
        } else {
          showRedirectButton(proxyHost);
        }
      }
    }
  }

  // ============================================================
  // §7. Floating Redirect Button (manual mode)
  // ============================================================

  function showRedirectButton(proxyHost) {
    var btn = document.createElement('div');
    btn.id = 'ecnu-proxy-btn';
    btn.textContent = t('redirectBtn');
    btn.addEventListener('click', function () {
      window.location.replace(
        'https://' + proxyHost + location.pathname + location.search + location.hash
      );
    });

    var closeBtn = document.createElement('span');
    closeBtn.textContent = '\u00d7';
    closeBtn.style.cssText =
      'position:absolute;top:2px;right:8px;cursor:pointer;font-size:16px;color:#fff;opacity:0.7;';
    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      btn.remove();
    });
    btn.appendChild(closeBtn);

    GM_addStyle(
      '#ecnu-proxy-btn{' +
        'position:fixed;bottom:30px;right:30px;z-index:2147483647;' +
        'background:linear-gradient(135deg,#1a73e8,#0d47a1);color:#fff;' +
        'padding:12px 24px;border-radius:8px;cursor:pointer;' +
        'font-size:14px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.3);' +
        'transition:transform 0.2s,box-shadow 0.2s;user-select:none;' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      '}' +
      '#ecnu-proxy-btn:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,0,0,0.4);}'
    );

    document.body.appendChild(btn);
  }

  // ============================================================
  // §8. SSO Auto Login
  // ============================================================

  function handleSSOLogin() {
    if (!location.pathname.startsWith('/login')) return;

    var ssoAutoLogin = GM_getValue('ssoAutoLogin', true);
    if (!ssoAutoLogin) return;

    var creds = getCredentials();
    if (!creds) {
      showNotification(t('noCredentials'));
      return;
    }

    var submitted = false;

    function tryFill() {
      if (submitted) return;
      var usernameInput =
        document.querySelector('#nameInput') ||
        document.querySelector('#username') ||
        document.querySelector('input[name="username"][type="text"]');
      var passwordInput =
        document.querySelector('input[type="password"]') ||
        document.querySelector('#password') ||
        document.querySelector('input[name="password"]');
      var submitBtn =
        document.querySelector('#submitBtn') ||
        document.querySelector('#login_submit') ||
        document.querySelector('button[type="submit"]');

      if (usernameInput && passwordInput && submitBtn) {
        submitted = true;
        observer.disconnect();
        fillAndSubmit(usernameInput, passwordInput, submitBtn, creds);
      }
    }

    // Wait for form elements to appear
    var observer = new MutationObserver(tryFill);

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });

    // Also try immediately in case elements are already present
    setTimeout(tryFill, 500);
  }

  function fillAndSubmit(usernameInput, passwordInput, submitBtn, creds) {
    // Use native setter to trigger Angular/React/Vue change events
    setNativeValue(usernameInput, creds.username);
    setNativeValue(passwordInput, creds.password);

    // Wait for framework to process input events, then enable and click submit
    setTimeout(function () {
      submitBtn.disabled = false;
      submitBtn.classList.remove('disabled');
      submitBtn.click();
    }, 500);
  }

  function setNativeValue(el, value) {
    var nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    ).set;
    nativeSetter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function showNotification(msg) {
    try {
      GM_notification({ text: msg, title: 'ECNU 文献快速获取', timeout: 5000 });
    } catch (_) {
      alert(msg);
    }
  }

  // ============================================================
  // §9. Library Page: Mapping Update via iframe Crawling
  // ============================================================

  function injectUpdateButton() {
    var btn = document.createElement('div');
    btn.id = 'ecnu-update-mapping-btn';
    btn.textContent = t('updateBtn');
    btn.addEventListener('click', startMappingUpdate);

    GM_addStyle(
      '#ecnu-update-mapping-btn{' +
        'position:fixed;bottom:30px;right:30px;z-index:2147483647;' +
        'background:linear-gradient(135deg,#34a853,#1b7a34);color:#fff;' +
        'padding:12px 24px;border-radius:8px;cursor:pointer;' +
        'font-size:14px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.3);' +
        'transition:transform 0.2s;user-select:none;' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      '}' +
      '#ecnu-update-mapping-btn:hover{transform:translateY(-2px);}' +
      '#ecnu-update-progress{' +
        'position:fixed;bottom:80px;right:30px;z-index:2147483647;' +
        'background:#fff;color:#333;padding:16px 24px;border-radius:8px;' +
        'box-shadow:0 4px 16px rgba(0,0,0,0.2);font-size:13px;max-width:360px;' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      '}'
    );

    document.body.appendChild(btn);
  }

  function collectDetailLinks() {
    var items = document.querySelectorAll('.news_listss.clearfix');
    var detailLinks = [];
    items.forEach(function (item) {
      var titleLink = item.querySelector('.table_news.news_tit a');
      var helpLink = item.querySelector('.table_news.news_help a');
      if (titleLink && helpLink) {
        var detailUrl = helpLink.href;
        // Fix Mixed Content: convert http to https for iframe loading
        if (detailUrl.indexOf('http://') === 0) {
          detailUrl = detailUrl.replace('http://', 'https://');
        }
        detailLinks.push({
          name: titleLink.textContent.trim(),
          originalUrl: titleLink.href,
          detailUrl: detailUrl,
        });
      }
    });
    return detailLinks;
  }

  function startMappingUpdate() {
    var btn = document.getElementById('ecnu-update-mapping-btn');
    if (btn) btn.textContent = t('updating');

    // Click "查看更多" buttons to load all databases first
    var moreButtons = document.querySelectorAll('div.search_more a, a.search_more');
    if (moreButtons.length > 0) {
      moreButtons.forEach(function (a) { a.click(); });
      // Wait for more items to load, then collect
      setTimeout(function () { doMappingUpdate(btn); }, 2000);
    } else {
      doMappingUpdate(btn);
    }
  }

  function doMappingUpdate(btn) {
    var detailLinks = collectDetailLinks();

    if (detailLinks.length === 0) {
      if (btn) btn.textContent = t('updateBtn');
      return;
    }

    // Show progress
    var progressDiv = document.createElement('div');
    progressDiv.id = 'ecnu-update-progress';
    progressDiv.textContent = t('updateProgress') + ': 0/' + detailLinks.length;
    document.body.appendChild(progressDiv);

    var mapping = getMapping();
    var completed = 0;

    function processNext(idx) {
      if (idx >= detailLinks.length) {
        saveMapping(mapping);
        progressDiv.textContent = t('updateDone') + ' (' + Object.keys(mapping).length + ')';
        if (btn) btn.textContent = t('updateBtn');
        setTimeout(function () {
          progressDiv.remove();
        }, 3000);
        return;
      }

      var entry = detailLinks[idx];
      var iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:absolute;width:0;height:0;border:none;visibility:hidden;';
      document.body.appendChild(iframe);

      var timer = setTimeout(function () {
        cleanup();
        processNext(idx + 1);
      }, 5000);

      iframe.onload = function () {
        clearTimeout(timer);
        setTimeout(function () {
          try {
            var doc = iframe.contentDocument;
            if (doc) {
              var proxyLinks = doc.querySelectorAll('a[href*="proxy.ecnu"]');
              proxyLinks.forEach(function (a) {
                try {
                  var proxyUrl = new URL(a.href);
                  var proxyHostname = proxyUrl.hostname;
                  if (proxyHostname.endsWith(PROXY_SUFFIX)) {
                    var proxyPrefix = proxyHostname.slice(0, -PROXY_SUFFIX.length);

                    // Try to find original hostname from the page (use first valid match)
                    var originalUrl = null;
                    var accessLinks = doc.querySelectorAll('a[href]:not([href*="proxy.ecnu"]):not([href*="lib.ecnu"])');
                    for (var i = 0; i < accessLinks.length; i++) {
                      try {
                        var u = new URL(accessLinks[i].href);
                        if (u.hostname && u.hostname !== LIB_LIST_HOST && !u.hostname.endsWith(PROXY_SUFFIX)) {
                          originalUrl = u.hostname;
                          break;
                        }
                      } catch (_) { /* skip */ }
                    }

                    // Also try from the entry's original URL
                    if (!originalUrl) {
                      try {
                        originalUrl = new URL(entry.originalUrl).hostname;
                      } catch (_) { /* skip */ }
                    }

                    if (originalUrl && proxyPrefix) {
                      mapping[originalUrl] = proxyPrefix;
                    }
                  }
                } catch (_) { /* skip */ }
              });
            }
          } catch (_) { /* cross-origin or other error */ }

          cleanup();
          completed++;
          progressDiv.textContent = t('updateProgress') + ': ' + completed + '/' + detailLinks.length;
          processNext(idx + 1);
        }, 800);
      };

      iframe.onerror = function () {
        clearTimeout(timer);
        cleanup();
        processNext(idx + 1);
      };

      function cleanup() {
        try {
          document.body.removeChild(iframe);
        } catch (_) { /* already removed */ }
      }

      iframe.src = entry.detailUrl;
    }

    processNext(0);
  }

  // ============================================================
  // §10. Settings Panel
  // ============================================================

  function openSettings() {
    // Remove existing panel if any
    var existing = document.getElementById('ecnu-settings-overlay');
    if (existing) existing.remove();

    var lang = GM_getValue('lang', 'zh');
    var autoRedirect = GM_getValue('autoRedirect', true);
    var matchMode = GM_getValue('matchMode', 'dynamic');
    var ssoAutoLogin = GM_getValue('ssoAutoLogin', true);
    var creds = getCredentials();
    var mapping = getMapping();

    GM_addStyle(
      '#ecnu-settings-overlay{' +
        'position:fixed;top:0;left:0;width:100%;height:100%;' +
        'background:rgba(0,0,0,0.5);z-index:2147483647;' +
        'display:flex;align-items:center;justify-content:center;' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      '}' +
      '#ecnu-settings-panel{' +
        'background:#fff;border-radius:12px;padding:32px;width:520px;max-width:90vw;' +
        'max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.3);' +
        'color:#333;line-height:1.6;' +
      '}' +
      '#ecnu-settings-panel h2{margin:0 0 20px;font-size:20px;color:#1a73e8;}' +
      '#ecnu-settings-panel h3{margin:20px 0 8px;font-size:15px;color:#555;border-bottom:1px solid #eee;padding-bottom:4px;}' +
      '#ecnu-settings-panel label{display:block;margin:6px 0;font-size:13px;color:#666;}' +
      '#ecnu-settings-panel input[type="text"],#ecnu-settings-panel input[type="password"]{' +
        'width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;' +
        'font-size:14px;box-sizing:border-box;margin-top:2px;' +
      '}' +
      '#ecnu-settings-panel input[type="text"]:focus,#ecnu-settings-panel input[type="password"]:focus{' +
        'outline:none;border-color:#1a73e8;box-shadow:0 0 0 2px rgba(26,115,232,0.2);' +
      '}' +
      '#ecnu-settings-panel button{' +
        'padding:8px 20px;border:none;border-radius:6px;cursor:pointer;' +
        'font-size:13px;font-weight:500;transition:background 0.2s;' +
      '}' +
      '.ecnu-btn-primary{background:#1a73e8;color:#fff;}' +
      '.ecnu-btn-primary:hover{background:#1557b0;}' +
      '.ecnu-btn-danger{background:#ea4335;color:#fff;font-size:12px!important;padding:4px 10px!important;}' +
      '.ecnu-btn-danger:hover{background:#c5221f;}' +
      '.ecnu-btn-secondary{background:#f1f3f4;color:#333;}' +
      '.ecnu-btn-secondary:hover{background:#e0e2e3;}' +
      '.ecnu-radio-group{display:flex;gap:16px;margin:6px 0;}' +
      '.ecnu-radio-group label{display:flex;align-items:center;gap:4px;cursor:pointer;font-size:14px;color:#333;}' +
      '.ecnu-mapping-list{max-height:200px;overflow-y:auto;border:1px solid #eee;border-radius:6px;margin:8px 0;}' +
      '.ecnu-mapping-item{display:flex;align-items:center;justify-content:space-between;padding:6px 12px;border-bottom:1px solid #f5f5f5;font-size:12px;}' +
      '.ecnu-mapping-item:last-child{border-bottom:none;}' +
      '.ecnu-add-row{display:flex;gap:8px;margin:8px 0;align-items:center;}' +
      '.ecnu-add-row input{flex:1;padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:12px;}'
    );

    var overlay = document.createElement('div');
    overlay.id = 'ecnu-settings-overlay';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    var panel = document.createElement('div');
    panel.id = 'ecnu-settings-panel';

    panel.innerHTML =
      '<h2>' + t('settingsTitle') + '</h2>' +
      // Language
      '<h3>' + t('language') + '</h3>' +
      '<div class="ecnu-radio-group">' +
        '<label><input type="radio" name="ecnu-lang" value="zh"' + (lang === 'zh' ? ' checked' : '') + '> 中文</label>' +
        '<label><input type="radio" name="ecnu-lang" value="en"' + (lang === 'en' ? ' checked' : '') + '> English</label>' +
      '</div>' +
      // Credentials
      '<h3>' + t('credentials') + '</h3>' +
      '<label>' + t('username') +
        '<input type="text" id="ecnu-username" value="' + (creds ? escapeHtml(creds.username) : '') + '" autocomplete="off">' +
      '</label>' +
      '<label>' + t('password') +
        '<input type="password" id="ecnu-password" value="' + (creds ? escapeHtml(creds.password) : '') + '" autocomplete="off">' +
      '</label>' +
      '<div style="margin-top:8px;">' +
        '<button class="ecnu-btn-primary" id="ecnu-save-creds">' + t('save') + '</button>' +
      '</div>' +
      // Match mode
      '<h3>' + t('matchMode') + '</h3>' +
      '<div class="ecnu-radio-group" style="flex-direction:column;gap:6px;">' +
        '<label><input type="radio" name="ecnu-match" value="static"' + (matchMode === 'static' ? ' checked' : '') + '> ' + t('matchStatic') + '</label>' +
        '<label><input type="radio" name="ecnu-match" value="dynamic"' + (matchMode === 'dynamic' ? ' checked' : '') + '> ' + t('matchDynamic') + '</label>' +
      '</div>' +
      // Redirect mode
      '<h3>' + t('redirectMode') + '</h3>' +
      '<div class="ecnu-radio-group">' +
        '<label><input type="radio" name="ecnu-redirect" value="auto"' + (autoRedirect ? ' checked' : '') + '> ' + t('autoRedirect') + '</label>' +
        '<label><input type="radio" name="ecnu-redirect" value="manual"' + (!autoRedirect ? ' checked' : '') + '> ' + t('manualRedirect') + '</label>' +
      '</div>' +
      // SSO Auto Login
      '<h3>' + t('ssoAutoLogin') + '</h3>' +
      '<div class="ecnu-radio-group">' +
        '<label><input type="radio" name="ecnu-sso" value="on"' + (ssoAutoLogin ? ' checked' : '') + '> ' + t('ssoAutoLoginOn') + '</label>' +
        '<label><input type="radio" name="ecnu-sso" value="off"' + (!ssoAutoLogin ? ' checked' : '') + '> ' + t('ssoAutoLoginOff') + '</label>' +
      '</div>' +
      // Mapping
      '<h3>' + t('mappingTitle') + ' (' + t('mappingCount') + ': ' + Object.keys(mapping).length + ')</h3>' +
      '<div class="ecnu-mapping-list" id="ecnu-mapping-list"></div>' +
      '<div class="ecnu-add-row">' +
        '<input type="text" id="ecnu-new-domain" placeholder="' + t('domain') + '">' +
        '<input type="text" id="ecnu-new-proxy" placeholder="' + t('proxyDomain') + '">' +
        '<button class="ecnu-btn-primary" id="ecnu-add-mapping">' + t('add') + '</button>' +
      '</div>' +
      '<div style="margin-top:8px;display:flex;gap:8px;">' +
        '<button class="ecnu-btn-secondary" id="ecnu-reset-mapping">' + t('reset') + '</button>' +
      '</div>' +
      // Close
      '<div style="margin-top:20px;text-align:right;">' +
        '<button class="ecnu-btn-secondary" id="ecnu-close-settings">' + t('close') + '</button>' +
      '</div>';

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Render mapping list
    renderMappingList(mapping, panel);

    // Event listeners
    panel.querySelectorAll('input[name="ecnu-lang"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        GM_setValue('lang', this.value);
        overlay.remove();
        openSettings(); // re-render with new language
      });
    });

    panel.querySelectorAll('input[name="ecnu-match"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        GM_setValue('matchMode', this.value);
      });
    });

    panel.querySelectorAll('input[name="ecnu-redirect"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        GM_setValue('autoRedirect', this.value === 'auto');
      });
    });

    panel.querySelectorAll('input[name="ecnu-sso"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        GM_setValue('ssoAutoLogin', this.value === 'on');
      });
    });

    panel.querySelector('#ecnu-save-creds').addEventListener('click', function () {
      var u = panel.querySelector('#ecnu-username').value;
      var p = panel.querySelector('#ecnu-password').value;
      saveCredentials(u, p);
      this.textContent = t('saved');
      var self = this;
      setTimeout(function () {
        self.textContent = t('save');
      }, 1500);
    });

    panel.querySelector('#ecnu-add-mapping').addEventListener('click', function () {
      var d = panel.querySelector('#ecnu-new-domain').value.trim();
      var p = panel.querySelector('#ecnu-new-proxy').value.trim();
      if (d && p) {
        mapping[d] = p;
        saveMapping(mapping);
        renderMappingList(mapping, panel);
        panel.querySelector('#ecnu-new-domain').value = '';
        panel.querySelector('#ecnu-new-proxy').value = '';
      }
    });

    panel.querySelector('#ecnu-reset-mapping').addEventListener('click', function () {
      if (confirm(t('resetConfirm'))) {
        resetMapping();
        mapping = getMapping();
        renderMappingList(mapping, panel);
      }
    });

    panel.querySelector('#ecnu-close-settings').addEventListener('click', function () {
      overlay.remove();
    });
  }

  function renderMappingList(mapping, panel) {
    var container = (panel || document).querySelector('#ecnu-mapping-list');
    if (!container) return;
    container.innerHTML = '';
    var keys = Object.keys(mapping).sort();
    keys.forEach(function (domain) {
      var item = document.createElement('div');
      item.className = 'ecnu-mapping-item';
      item.innerHTML =
        '<span style="flex:1;word-break:break-all;">' +
        escapeHtml(domain) + ' <span style="color:#999;">\u2192</span> ' +
        escapeHtml(mapping[domain] + PROXY_SUFFIX) +
        '</span>';
      var delBtn = document.createElement('button');
      delBtn.className = 'ecnu-btn-danger';
      delBtn.textContent = t('delete');
      delBtn.addEventListener('click', function () {
        delete mapping[domain];
        saveMapping(mapping);
        renderMappingList(mapping);
      });
      item.appendChild(delBtn);
      container.appendChild(item);
    });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

})();
