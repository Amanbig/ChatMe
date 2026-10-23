use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TtsStatus {
    pub supported: bool,
    pub engine: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TtsVoice {
    pub name: String,
    pub lang: String,
    pub voice_uri: String,
}

pub fn get_tts_status() -> TtsStatus {
    #[cfg(target_os = "linux")]
    {
        let has_spd = Command::new("spd-say").arg("--version").output().is_ok();
        if has_spd {
            return TtsStatus {
                supported: true,
                engine: "Speech Dispatcher (spd-say)".to_string(),
            };
        }
        let has_espeak = Command::new("espeak").arg("--version").output().is_ok();
        if has_espeak {
            return TtsStatus {
                supported: true,
                engine: "eSpeak (espeak)".to_string(),
            };
        }
    }

    #[cfg(target_os = "macos")]
    {
        return TtsStatus {
            supported: true,
            engine: "macOS System Speech (say)".to_string(),
        };
    }

    #[cfg(target_os = "windows")]
    {
        return TtsStatus {
            supported: true,
            engine: "Windows SAPI (PowerShell)".to_string(),
        };
    }

    #[allow(unreachable_code)]
    TtsStatus {
        supported: false,
        engine: "None".to_string(),
    }
}

pub fn get_native_voices() -> Vec<TtsVoice> {
    #[cfg(target_os = "linux")]
    {
        vec![
            TtsVoice { name: "System Default".to_string(), lang: "en-US".to_string(), voice_uri: "default".to_string() },
            TtsVoice { name: "Male 1".to_string(), lang: "en-US".to_string(), voice_uri: "male1".to_string() },
            TtsVoice { name: "Female 1".to_string(), lang: "en-US".to_string(), voice_uri: "female1".to_string() },
            TtsVoice { name: "Male 2".to_string(), lang: "en-US".to_string(), voice_uri: "male2".to_string() },
            TtsVoice { name: "Female 2".to_string(), lang: "en-US".to_string(), voice_uri: "female2".to_string() },
        ]
    }

    #[cfg(target_os = "macos")]
    {
        vec![
            TtsVoice { name: "System Default".to_string(), lang: "en-US".to_string(), voice_uri: "default".to_string() },
            TtsVoice { name: "Samantha".to_string(), lang: "en-US".to_string(), voice_uri: "Samantha".to_string() },
            TtsVoice { name: "Alex".to_string(), lang: "en-US".to_string(), voice_uri: "Alex".to_string() },
            TtsVoice { name: "Victoria".to_string(), lang: "en-US".to_string(), voice_uri: "Victoria".to_string() },
        ]
    }

    #[cfg(target_os = "windows")]
    {
        vec![
            TtsVoice { name: "Microsoft David".to_string(), lang: "en-US".to_string(), voice_uri: "David".to_string() },
            TtsVoice { name: "Microsoft Zira".to_string(), lang: "en-US".to_string(), voice_uri: "Zira".to_string() },
        ]
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        vec![]
    }
}

pub fn speak(text: &str, voice: Option<&str>, rate: Option<f32>, pitch: Option<f32>, volume: Option<f32>) -> Result<(), String> {
    if text.trim().is_empty() {
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("spd-say").arg("-S").output();

        let mut cmd = Command::new("spd-say");

        if let Some(r) = rate {
            let spd_rate = ((r.clamp(0.5, 2.0) - 1.0) * 100.0) as i32;
            cmd.arg("-r").arg(spd_rate.to_string());
        }

        if let Some(p) = pitch {
            let spd_pitch = ((p.clamp(0.0, 2.0) - 1.0) * 100.0) as i32;
            cmd.arg("-p").arg(spd_pitch.to_string());
        }

        if let Some(v) = volume {
            let spd_vol = ((v.clamp(0.0, 1.0) - 0.5) * 200.0) as i32;
            cmd.arg("-i").arg(spd_vol.to_string());
        }

        if let Some(v) = voice {
            if v != "default" && !v.is_empty() {
                cmd.arg("-t").arg(v);
            }
        }

        cmd.arg(text);
        cmd.spawn().map_err(|e| format!("Failed to spawn spd-say: {}", e))?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("killall").arg("say").output();

        let mut cmd = Command::new("say");
        if let Some(v) = voice {
            if v != "default" && !v.is_empty() {
                cmd.arg("-v").arg(v);
            }
        }
        if let Some(r) = rate {
            let wpm = (180.0 * r) as u32;
            cmd.arg("-r").arg(wpm.to_string());
        }
        cmd.arg(text);
        cmd.spawn().map_err(|e| format!("Failed to spawn say: {}", e))?;
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        let clean_text = text.replace("'", "''");
        let rate_val = rate.map(|r| ((r - 1.0) * 10.0) as i32).unwrap_or(0);
        let vol_val = volume.map(|v| (v * 100.0) as u32).unwrap_or(100);

        let ps_code = format!(
            "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = {}; $s.Volume = {}; $s.Speak('{}');",
            rate_val.clamp(-10, 10),
            vol_val.clamp(0, 100),
            clean_text
        );

        Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &ps_code])
            .spawn()
            .map_err(|e| format!("Failed to spawn powershell TTS: {}", e))?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("Text to speech not supported on this platform".to_string())
}

pub fn cancel_speech() -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("spd-say").arg("-S").output();
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("killall").arg("say").output();
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", "Get-Process powershell | Where-Object { $_.CommandLine -like '*System.Speech*' } | Stop-Process"])
            .output();
        return Ok(());
    }

    #[allow(unreachable_code)]
    Ok(())
}
