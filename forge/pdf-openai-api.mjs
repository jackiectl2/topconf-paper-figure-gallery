// PDF parsing only. Step 3 generation and Step 4 reconstruction do not use this module.
import {pdfResponseJSON} from './chat-api.mjs';

export async function countOpenAIPdfTokens(origin, body, key, {fetchImpl=fetch}={}) {
  if (body?.model !== 'gpt-6.1-sol') throw new Error('Token counting is configured for GPT 6.1 SOL only.');
  const response=await fetchImpl(origin+'/api/openai-count',{
    method:'POST',headers:{'Content-Type':'application/json','x-openai-api-key':key,'x-openai-model':body.model},
    body:JSON.stringify(body)
  });
  if(!response.ok) throw new Error('GPT input-token count failed (HTTP '+response.status+').');
  const value=(await response.json()).input_tokens;
  if(!Number.isSafeInteger(value)||value<0) throw new Error('GPT input-token count was invalid.');
  return value;
}

function apiError(status, data, requestId) {
  const code = String(data?.error?.code || data?.error?.type || '');
  let message;
  if (status === 429 && /insufficient_quota|billing_hard_limit|usage_limit_reached/.test(code)) {
    message = 'OpenAI 官网账户额度不足，请检查 API 项目的余额和用量上限；更换 PDF 输入方式无法解决。';
  } else if (status === 429) {
    message = 'OpenAI 官网请求被限流，请稍后重试或检查项目的速率限制。';
  } else if (status === 401) {
    message = 'OpenAI 官网 API Key 无效或已失效，请检查 API Key。';
  } else if (status === 403 || status === 404) {
    message = 'OpenAI 官网拒绝访问，请检查项目权限和所选模型是否可用。';
  } else {
    message = 'OpenAI 官网 PDF 解析请求失败。';
  }
  return Object.assign(new Error(`${message} HTTP ${status}${code ? '；' + code : ''}${data?.error?.message ? '；' + String(data.error.message).slice(0,500) : ''}${requestId ? '；request_id=' + requestId : ''}`), {
    status, code, stopPdfFallback: [401, 403, 404, 429].includes(status)
  });
}

export async function requestOpenAIPdf(base, body, key, {
  fetchImpl = fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
} = {}) {
  const url = new URL(base.replace(/\/$/, '') + '/responses');
  if (url.origin !== 'https://api.openai.com' || url.pathname !== '/v1/responses') {
    throw new Error('PDF 官网请求必须使用 https://api.openai.com/v1');
  }
  const initial = structuredClone(body);
  // Keep the reasoning allowance within older models' documented output limits.
  const model = String(initial.model || '');
  const outputLimit = /^gpt-4o-2024-05-13$|^gpt-4-turbo(?:-|$)/.test(model) ? 4096 :
    /^gpt-4o(?:-|$)/.test(model) ? 16384 : /^gpt-4\.1(?:-|$)/.test(model) ? 32768 : 100000;
  const sol=model==='gpt-6.1-sol';
  initial.max_output_tokens = Math.min(sol?48000:25000, outputLimit);
  let current = initial, recovered = false, rateRetried = false;
  for (;;) {
    const response = await fetchImpl(url.href, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + key},
      body: JSON.stringify(current)
    });
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); }
    catch {
      if (!response.ok) throw apiError(response.status, null, response.headers.get('x-request-id'));
      throw new Error('OpenAI 官网返回了非 JSON 响应，请检查网络或接入地址。');
    }
    if (!response.ok) {
      const error = apiError(response.status, data, response.headers.get('x-request-id'));
      // Retry only explicit transient rate limits, at most once. Quota is never retried.
      const after = response.headers.get('retry-after');
      const seconds = after === null ? 1 : Number(after);
      if (response.status === 429 && error.code === 'rate_limit_exceeded' && !rateRetried &&
          Number.isFinite(seconds) && seconds >= 0 && seconds <= 30) {
        rateRetried = true;
        await sleep(Math.max(1000, seconds * 1000));
        continue;
      }
      throw error;
    }
    if (data.status === 'failed' || (data.status === 'incomplete' &&
        data.incomplete_details?.reason && data.incomplete_details.reason !== 'max_output_tokens')) {
      throw Object.assign(new Error('OpenAI 官网 PDF 解析未完成：' +
        (data.error?.message || data.incomplete_details?.reason || 'failed')), {stopPdfFallback: true});
    }
    try { return pdfResponseJSON(data); }
    catch (error) {
      if (!error.pdfFormatFailure || recovered) {
        // Repeating the same paper as text/images cannot fix an exhausted reasoning budget.
        if (error.truncated) error.stopPdfFallback = true;
        throw error;
      }
      recovered = true;
      current = structuredClone(initial);
      current.max_output_tokens = Math.min(sol?48000:100000, outputLimit);
      current.input.push({role: 'user', content: [{type: 'input_text', text:
        'The previous output failed JSON or English-language validation. Return a complete, concise JSON object with selectedSections and nonempty summary fields. Translate Chinese source text into faithful English in every generated field. Do not include Markdown or commentary.'}]});
    }
  }
}
