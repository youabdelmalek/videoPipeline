"""Windows tray notifications for long-running jobs that end badly."""

from __future__ import annotations

import os
import subprocess

from backend.config import ROOT


def _powershell_string(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def notify_windows(title: str, message: str) -> None:
    """Show a balloon tip. No-op on non-Windows hosts and on any failure."""
    if os.name != "nt":
        return

    script = f"""
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = [System.Drawing.SystemIcons]::Warning
$notify.BalloonTipTitle = {_powershell_string(title[:80])}
$notify.BalloonTipText = {_powershell_string(message[:220])}
$notify.Visible = $true
$notify.ShowBalloonTip(8000)
Start-Sleep -Seconds 9
$notify.Dispose()
"""
    try:
        subprocess.Popen(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
            cwd=ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception:  # noqa: BLE001 - a failed toast must never break a job.
        return
