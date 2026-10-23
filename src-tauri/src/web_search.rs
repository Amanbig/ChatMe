use serde::{Deserialize, Serialize};
use regex::Regex;
use anyhow::{Result, anyhow};
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WebSearchResult {
    pub title: String,
    pub url: String,
    pub snippet: String,
}

fn decode_html_entities(input: &str) -> String {
    input
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#x27;", "'")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&nbsp;", " ")
        .replace("&#8211;", "-")
        .replace("&#8212;", "--")
        .replace("&#8216;", "'")
        .replace("&#8217;", "'")
        .replace("&#8220;", "\"")
        .replace("&#8221;", "\"")
}

fn strip_html_tags(input: &str) -> String {
    let re = Regex::new(r"<[^>]*>").unwrap();
    let cleaned = re.replace_all(input, " ").to_string();
    cleaned.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Perform a search using DuckDuckGo
pub async fn duckduckgo_search(query: &str, max_results: Option<usize>) -> Result<Vec<WebSearchResult>> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
        .build()?;

    let max_count = max_results.unwrap_or(6).clamp(1, 15);

    // 1. Primary: DuckDuckGo Lite HTML Search
    let response = client
        .post("https://lite.duckduckgo.com/lite/")
        .form(&[("q", query)])
        .send()
        .await;

    if let Ok(res) = response {
        if res.status().is_success() {
            let html = res.text().await.unwrap_or_default();
            let results = parse_lite_duckduckgo_results(&html, max_count);
            if !results.is_empty() {
                return Ok(results);
            }
        }
    }

    // 2. Fallback: DuckDuckGo Instant Answer API
    let api_url = format!(
        "https://api.duckduckgo.com/?q={}&format=json&no_html=1&skip_disambig=1",
        urlencoding::encode(query)
    );

    let api_res = client.get(&api_url).send().await?;
    if api_res.status().is_success() {
        let json_val: serde_json::Value = api_res.json().await?;
        let mut results = Vec::new();

        // Check AbstractText
        if let Some(abstract_text) = json_val.get("AbstractText").and_then(|v| v.as_str()) {
            if !abstract_text.trim().is_empty() {
                let title = json_val.get("Heading").and_then(|v| v.as_str()).unwrap_or(query);
                let url = json_val.get("AbstractURL").and_then(|v| v.as_str()).unwrap_or("");
                results.push(WebSearchResult {
                    title: title.to_string(),
                    url: url.to_string(),
                    snippet: abstract_text.to_string(),
                });
            }
        }

        // Related Topics
        if let Some(topics) = json_val.get("RelatedTopics").and_then(|v| v.as_array()) {
            for topic in topics {
                if results.len() >= max_count {
                    break;
                }
                if let (Some(text), Some(url)) = (
                    topic.get("Text").and_then(|v| v.as_str()),
                    topic.get("FirstURL").and_then(|v| v.as_str())
                ) {
                    if !text.is_empty() && !url.is_empty() {
                        results.push(WebSearchResult {
                            title: text.chars().take(60).collect::<String>(),
                            url: url.to_string(),
                            snippet: text.to_string(),
                        });
                    }
                }
            }
        }

        if !results.is_empty() {
            return Ok(results);
        }
    }

    Err(anyhow!("No web search results found for: {}", query))
}

fn parse_lite_duckduckgo_results(html: &str, max_results: usize) -> Vec<WebSearchResult> {
    let mut results = Vec::new();

    // Regex to capture <a rel="nofollow" href="(URL)" class='result-link'>(TITLE)</a>
    let link_re = Regex::new(r#"<a[^>]+href=["']([^"']+)["'][^>]+class=['"]result-link['"][^>]*>([\s\S]*?)</a>"#).unwrap();
    let snippet_re = Regex::new(r#"<td[^>]+class=['"]result-snippet['"][^>]*>([\s\S]*?)</td>"#).unwrap();

    let mut links = Vec::new();
    for cap in link_re.captures_iter(html) {
        let mut raw_url = cap.get(1).map_or("", |m| m.as_str()).to_string();
        // Decode DDG redirect url if present (/l/?kh=-1&uddg=https%3A%2F%2F...)
        if raw_url.contains("uddg=") {
            if let Some(encoded_target) = raw_url.split("uddg=").nth(1) {
                let clean_encoded = encoded_target.split('&').next().unwrap_or(encoded_target);
                if let Ok(decoded) = urlencoding::decode(clean_encoded) {
                    raw_url = decoded.to_string();
                }
            }
        }
        let raw_title = cap.get(2).map_or("", |m| m.as_str());
        let clean_title = strip_html_tags(&decode_html_entities(raw_title));

        links.push((raw_url, clean_title));
    }

    let snippets: Vec<String> = snippet_re
        .captures_iter(html)
        .map(|cap| {
            let raw_snippet = cap.get(1).map_or("", |m| m.as_str());
            strip_html_tags(&decode_html_entities(raw_snippet))
        })
        .collect();

    for (i, (url, title)) in links.into_iter().enumerate() {
        if results.len() >= max_results {
            break;
        }
        let snippet = snippets.get(i).cloned().unwrap_or_else(|| title.clone());
        if !url.is_empty() && !title.is_empty() {
            results.push(WebSearchResult {
                title,
                url,
                snippet,
            });
        }
    }

    results
}

mod urlencoding {
    pub fn encode(s: &str) -> String {
        let mut result = String::new();
        for b in s.bytes() {
            match b {
                b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    result.push(b as char);
                }
                b' ' => result.push('+'),
                _ => {
                    result.push_str(&format!("%{:02X}", b));
                }
            }
        }
        result
    }

    pub fn decode(s: &str) -> Result<String, std::string::FromUtf8Error> {
        let mut bytes = Vec::new();
        let mut chars = s.bytes();
        while let Some(b) = chars.next() {
            match b {
                b'+' => bytes.push(b' '),
                b'%' => {
                    if let (Some(h1), Some(h2)) = (chars.next(), chars.next()) {
                        let hex = [h1, h2];
                        if let Ok(hex_str) = std::str::from_utf8(&hex) {
                            if let Ok(val) = u8::from_str_radix(hex_str, 16) {
                                bytes.push(val);
                                continue;
                            }
                        }
                        bytes.push(b'%');
                        bytes.push(h1);
                        bytes.push(h2);
                    } else {
                        bytes.push(b'%');
                    }
                }
                _ => bytes.push(b),
            }
        }
        String::from_utf8(bytes)
    }
}
