import { MacroData, NewsHeadline } from "@/types";

const FALLBACK_KURS = 16500;
const FALLBACK_TEMP = 32;
const FALLBACK_WHEAT = 613.25;
const FALLBACK_PALM = 65.94;
const FALLBACK_BTC = 1142829537;

export async function fetchExternalMarketData() {
  let currentISOTime = new Date().toISOString();
  let kursIDR = FALLBACK_KURS;
  let isRaining = false;
  let temperature = FALLBACK_TEMP;
  let btcIdrPrice = FALLBACK_BTC;
  let newsHeadlines: NewsHeadline[] = [];
  let wheatIndex = FALLBACK_WHEAT;
  let palmOilIndex = FALLBACK_PALM;

  try {
    const [
      timeRes,
      frankfurterRes,
      weatherRes,
      btcRes,
      rssRes,
      wheatRes,
      palmRes
    ] = await Promise.allSettled([
      fetch('https://timeapi.io/api/Time/current/zone?timeZone=Asia/Jakarta'),
      fetch('https://api.frankfurter.app/latest?from=USD&to=IDR'),
      fetch('https://api.open-meteo.com/v1/forecast?latitude=-6.2146&longitude=106.8451&current_weather=true'),
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=idr'),
      fetch('https://api.rss2json.com/v1/api.json?rss_url=https://www.cnbcindonesia.com/market/rss'),
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/ZW=F'),
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/ZL=F')
    ]);

    if (timeRes.status === 'fulfilled' && timeRes.value.ok) {
      try { const d = await timeRes.value.json(); if(d.dateTime) currentISOTime = d.dateTime + "+07:00"; } catch(e){}
    }
    if (frankfurterRes.status === 'fulfilled' && frankfurterRes.value.ok) {
      try { const d = await frankfurterRes.value.json(); if(d.rates?.IDR) kursIDR = d.rates.IDR; } catch(e){}
    }
    if (weatherRes.status === 'fulfilled' && weatherRes.value.ok) {
      try { 
        const d = await weatherRes.value.json(); 
        if(d.current_weather) {
          temperature = d.current_weather.temperature;
          const code = d.current_weather.weathercode;
          if ((code >= 51 && code <= 65) || (code >= 80 && code <= 82)) isRaining = true;
        }
      } catch(e){}
    }
    if (btcRes.status === 'fulfilled' && btcRes.value.ok) {
      try { const d = await btcRes.value.json(); if(d.bitcoin?.idr) btcIdrPrice = d.bitcoin.idr; } catch(e){}
    }
    if (rssRes.status === 'fulfilled' && rssRes.value.ok) {
      try { 
        const d = await rssRes.value.json(); 
        if(d.items) {
          newsHeadlines = d.items.slice(0, 15).map((i: any) => ({
            title: i.title.toUpperCase(),
            link: i.link,
            pubDate: i.pubDate
          }));
        }
      } catch(e){}
    }
    if (wheatRes.status === 'fulfilled' && wheatRes.value.ok) {
      try { const d = await wheatRes.value.json(); if(d?.chart?.result?.[0]?.meta?.regularMarketPrice) wheatIndex = d.chart.result[0].meta.regularMarketPrice; } catch(e){}
    }
    if (palmRes.status === 'fulfilled' && palmRes.value.ok) {
      try { const d = await palmRes.value.json(); if(d?.chart?.result?.[0]?.meta?.regularMarketPrice) palmOilIndex = d.chart.result[0].meta.regularMarketPrice; } catch(e){}
    }
  } catch (error) {
    console.error("External fetching error:", error);
  }

  const marketSentiment = isRaining ? "EXTREME_BULLISH" : temperature > 33 ? "BEARISH" : "NEUTRAL";

  return {
    currentISOTime,
    newsHeadlines,
    macro: {
      kursIDR,
      isRaining,
      temperature,
      wheatIndex,
      palmOilIndex,
      btcIdrPrice,
      marketSentiment,
    }
  };
}
