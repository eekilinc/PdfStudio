use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

/// The file the application keeps a recovery copy of the open document in.
///
/// The copy is written every minute while the document has unsaved changes,
/// and it is what the application offers to restore after an unexpected
/// exit. It lives beside the application's own data, not in the document's
/// folder, so it never travels with the file.
fn recovery_paths(app: &tauri::AppHandle) -> Result<(PathBuf, PathBuf), String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Uygulama verisi klasörü bulunamadı: {}", e))?;
    fs::create_dir_all(&dir).map_err(|e| format!("Klasör oluşturulamadı: {}", e))?;
    Ok((dir.join("recovery.pdf"), dir.join("recovery.json")))
}

/// Write the recovery copy of the open document.
///
/// The bytes are the document as it would be written to disk, so restoring
/// the copy gives back the work that was not saved yet.
#[tauri::command]
fn write_recovery(
    app: tauri::AppHandle,
    contents: Vec<u8>,
    filename: String,
) -> Result<(), String> {
    let (pdf_path, info_path) = recovery_paths(&app)?;

    // The copy is written to a temporary file first and then moved into
    // place, so an interrupted write cannot leave a half-written recovery
    // copy behind.
    let temp_path = pdf_path.with_extension("pdf.tmp");
    fs::write(&temp_path, &contents).map_err(|e| format!("Kurtarma kopyası yazılamadı: {}", e))?;
    fs::rename(&temp_path, &pdf_path).map_err(|e| format!("Kurtarma kopyası taşınamadı: {}", e))?;

    let saved_at = chrono_like_now();
    let info = format!(
        "{{\"filename\":{},\"savedAt\":{}}}",
        serde_escape(&filename),
        saved_at
    );
    fs::write(&info_path, info).map_err(|e| format!("Kurtarma bilgisi yazılamadı: {}", e))?;

    Ok(())
}

/// The recovery copy of the document, if there is one.
#[derive(serde::Serialize)]
struct RecoveryInfo {
    contents: Vec<u8>,
    filename: String,
    saved_at: u64,
}

/// Read the recovery copy of the document.
#[tauri::command]
fn read_recovery(app: tauri::AppHandle) -> Result<Option<RecoveryInfo>, String> {
    let (pdf_path, info_path) = recovery_paths(&app)?;

    if !pdf_path.exists() {
        return Ok(None);
    }

    let contents = fs::read(&pdf_path).map_err(|e| format!("Kurtarma kopyası okunamadı: {}", e))?;
    let meta = fs::read_to_string(&info_path).unwrap_or_default();

    let (filename, saved_at) = parse_recovery_meta(&meta);
    Ok(Some(RecoveryInfo { contents, filename, saved_at }))
}

/// Remove the recovery copy, after the document was saved.
#[tauri::command]
fn clear_recovery(app: tauri::AppHandle) -> Result<(), String> {
    let (pdf_path, info_path) = recovery_paths(&app)?;
    let _ = fs::remove_file(&pdf_path);
    let _ = fs::remove_file(&info_path);
    Ok(())
}

/// The current time in seconds since the epoch.
fn chrono_like_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Escape a string for the small JSON file the recovery information is
/// written in.
fn serde_escape(value: &str) -> String {
    let mut out = String::with_capacity(value.len() + 2);
    out.push('"');
    for ch in value.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push(' '),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

/// Read the file name and the time out of the recovery information.
fn parse_recovery_meta(meta: &str) -> (String, u64) {
    let mut filename = String::new();
    let mut saved_at = 0u64;

    if let Some(start) = meta.find("\"filename\"") {
        if let Some(open) = meta[start..].find('"').map(|i| start + i + 1) {
            if let Some(close) = meta[open..].find('"').map(|i| open + i) {
                filename = meta[open..close].to_string();
            }
        }
    }

    if let Some(start) = meta.find("\"savedAt\"") {
        if let Some(open) = meta[start..].find(':').map(|i| start + i + 1) {
            let digits: String = meta[open..]
                .chars()
                .take_while(|c| c.is_ascii_digit())
                .collect();
            saved_at = digits.parse().unwrap_or(0);
        }
    }

    (filename, saved_at)
}

#[tauri::command]
fn get_startup_file() -> Option<String> {
    let args: Vec<String> = env::args().collect();
    // Check if a file argument was passed (e.g. app.exe "C:\path\to\doc.pdf")
    for arg in args.iter().skip(1) {
        if !arg.starts_with("--") && arg.to_lowercase().ends_with(".pdf") && Path::new(arg).exists() {
            return Some(arg.clone());
        }
    }
    None
}

#[tauri::command]
fn read_pdf_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| format!("Dosya okunamadı: {}", e))
}

/// Write a file from the document bytes.
///
/// The bytes arrive as a JSON array of numbers, because that is what the
/// JavaScript side can produce: a typed array is not accepted for a `Vec<u8>`
/// parameter, so the caller has to expand it. That is the one remaining cost in
/// this path — a 20 MB document becomes roughly 160 MB of numbers plus a large
/// JSON string in transit. Moving to a raw IPC body would remove it, but
/// `tauri::ipc::Request` only exposes an `InvokeBody` and `invoke` has no raw
/// mode, so there is no way to do it from this API surface today.
#[tauri::command]
fn write_pdf_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| format!("Dosya kaydedilemedi: {}", e))
}

#[tauri::command]
fn open_pdf_dialog() -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let script = r#"
            [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
            Add-Type -AssemblyName System.Windows.Forms
            $d = New-Object System.Windows.Forms.OpenFileDialog
            $d.Title = 'PDF Belgesi Seç'
            $d.Filter = 'PDF Belgeleri (*.pdf)|*.pdf|Tüm Dosyalar (*.*)|*.*'
            $d.CheckFileExists = $true
            $d.RestoreDirectory = $true
            $d.Multiselect = $false
            if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
                [Console]::Out.Write($d.FileName)
            }
        "#;
        let output = Command::new("powershell")
            .args(["-STA", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| e.to_string())?;

        let res = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if res.is_empty() {
            Ok(None)
        } else {
            Ok(Some(res))
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(None)
    }
}

#[tauri::command]
fn pick_save_pdf_path(default_name: String) -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let sanitized = default_name.replace('\'', "").replace('"', "");
        let script = format!(
            r#"
            [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
            Add-Type -AssemblyName System.Windows.Forms
            $d = New-Object System.Windows.Forms.SaveFileDialog
            $d.Title = 'PDF Olarak Kaydet'
            $d.Filter = 'PDF Belgeleri (*.pdf)|*.pdf|Tüm Dosyalar (*.*)|*.*'
            $d.FileName = '{}'
            $d.RestoreDirectory = $true
            if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{
                [Console]::Out.Write($d.FileName)
            }}
            "#,
            sanitized
        );
        let output = Command::new("powershell")
            .args(["-STA", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &script])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| e.to_string())?;

        let res = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if res.is_empty() {
            Ok(None)
        } else {
            Ok(Some(res))
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = default_name;
        Ok(None)
    }
}

#[tauri::command]
fn pick_save_custom_file(default_name: String, filter_desc: String, filter_ext: String) -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let sanitized_name = default_name.replace('\'', "").replace('"', "");
        let sanitized_desc = filter_desc.replace('\'', "").replace('"', "");
        let sanitized_ext = filter_ext.replace('\'', "").replace('"', "");
        let script = format!(
            r#"
            [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
            Add-Type -AssemblyName System.Windows.Forms
            $d = New-Object System.Windows.Forms.SaveFileDialog
            $d.Title = 'Farklı Kaydet'
            $d.Filter = '{0} (*.{1})|*.{1}|Tüm Dosyalar (*.*)|*.*'
            $d.FileName = '{2}'
            $d.RestoreDirectory = $true
            if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{
                [Console]::Out.Write($d.FileName)
            }}
            "#,
            sanitized_desc, sanitized_ext, sanitized_name
        );
        let output = Command::new("powershell")
            .args(["-STA", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &script])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| e.to_string())?;

        let res = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if res.is_empty() {
            Ok(None)
        } else {
            Ok(Some(res))
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (default_name, filter_desc, filter_ext);
        Ok(None)
    }
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| format!("Dosya kaydedilemedi: {}", e))
}

/// Open a URL in the user's browser.
///
/// The URL is restricted to `https`/`http` and rejected if it contains a shell
/// metacharacter. `cmd /C start` hands its argument to the Windows shell, where
/// `&`, `|` and `>` are command separators, so an unvalidated URL reaching this
/// command from the webview would be a command injection. Rejecting the
/// metacharacters as well as the scheme means a bad URL fails loudly instead of
/// silently launching something unexpected.
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    let trimmed = url.trim();

    if !(trimmed.starts_with("https://") || trimmed.starts_with("http://")) {
        return Err("Yalnızca http ve https adresleri açılabilir.".to_string());
    }

    if trimmed
        .chars()
        .any(|c| matches!(c, '&' | '|' | '<' | '>' | '^' | '"' | '`' | '\r' | '\n' | '\0'))
    {
        return Err("Adres güvenli olmayan karakterler içeriyor.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        Command::new("cmd")
            .args(["/C", "start", "", trimmed])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = trimmed;
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .setup(|app| {
            let icon_bytes = include_bytes!("../icons/icon.png");
            if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
                for window in app.webview_windows().values() {
                    let _ = window.set_icon(icon.clone());
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_startup_file,
            read_pdf_file,
            write_pdf_file,
            write_text_file,
            open_pdf_dialog,
            pick_save_pdf_path,
            pick_save_custom_file,
            open_url,
            write_recovery,
            read_recovery,
            clear_recovery
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
