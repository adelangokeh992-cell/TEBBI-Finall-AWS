"""
AI utilities: token counting and context truncation so the model can "read" full patient data.
"""
import logging
from typing import List, Tuple
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

# Reserve space for system message + response. gpt-4o has 128k, we cap input to leave room.
DEFAULT_MAX_CONTEXT_TOKENS = 100_000
DEFAULT_MAX_OUTPUT_TOKENS = 8192


def count_tokens_openai(text: str) -> int:
    """Count tokens for OpenAI models (cl100k_base). Returns 0 on error."""
    try:
        import tiktoken
        enc = tiktoken.get_encoding("cl100k_base")
        return len(enc.encode(text))
    except Exception as e:
        logger.warning(f"tiktoken count failed: {e}")
        return 0


def estimate_tokens(text: str) -> int:
    """Rough token estimate (~4 chars per token) for Gemini or when tiktoken unavailable."""
    if not text:
        return 0
    return max(1, len(text) // 4)


def count_tokens_messages_openai(messages: List[dict]) -> int:
    """Total token count for a list of OpenAI-format messages (role + content)."""
    total = 0
    try:
        import tiktoken
        enc = tiktoken.get_encoding("cl100k_base")
        for m in messages:
            role = (m.get("role") or "") + ": "
            content = m.get("content") or ""
            if isinstance(content, list):
                for c in content:
                    if c.get("type") == "text":
                        content = c.get("text", "")
                        break
                    elif c.get("type") == "image_url":
                        total += 765  # rough image token cost
                else:
                    content = ""
            total += len(enc.encode(role + (content if isinstance(content, str) else "")))
        return total
    except Exception as e:
        logger.warning(f"tiktoken messages count failed: {e}")
        for m in messages:
            c = m.get("content") or ""
            if isinstance(c, str):
                total += estimate_tokens(c)
            else:
                total += 800
        return total


def truncate_text_to_tokens(text: str, max_tokens: int, use_tiktoken: bool = True) -> str:
    """Truncate text to fit within max_tokens. Tries tiktoken first."""
    n = count_tokens_openai(text) if use_tiktoken else estimate_tokens(text)
    if n <= max_tokens:
        return text
    enc = None
    if use_tiktoken:
        try:
            import tiktoken
            enc = tiktoken.get_encoding("cl100k_base")
        except Exception:
            pass
    if enc:
        tokens = enc.encode(text)
        truncated = enc.decode(tokens[:max_tokens])
        return truncated
    approx = max_tokens * 4
    return text[:approx] + "..." if len(text) > approx else text


def build_visits_context_with_summary(
    visits: List[dict],
    max_recent_months: int = 24,
    max_recent_count: int = 50,
    lang_ar: bool = True,
) -> Tuple[str, int]:
    """
    Build visit history context: full detail for recent period, then one-line summary for older.
    Returns (context_string, number_of_visits_included_in_detail).
    """
    if not visits:
        return ("• لا توجد زيارات مسجلة" if lang_ar else "• No visits recorded", 0)

    cutoff = (datetime.now(timezone.utc) - timedelta(days=max_recent_months * 30)).isoformat()[:10]
    recent = []
    older = []
    for v in visits:
        created = (v.get("created_at") or "")[:10] if v.get("created_at") else ""
        if created >= cutoff:
            recent.append(v)
        else:
            older.append(v)

    lines = []
    # Recent: full detail, up to max_recent_count
    detail = recent[:max_recent_count]
    if lang_ar:
        for v in detail:
            lines.append(f"""📅 الزيارة: {v.get('created_at', '')[:10] if v.get('created_at') else 'غير محدد'}
   السبب: {v.get('reason', 'غير محدد')}
   التشخيص: {v.get('diagnosis', 'غير محدد')}
   العلامات الحيوية: الحرارة {v.get('temperature', '-')}° | الضغط {v.get('blood_pressure_systolic', '-')}/{v.get('blood_pressure_diastolic', '-')} | النبض {v.get('heart_rate', '-')} | O2 {v.get('oxygen_saturation', '-')}%
   الوصفة: {', '.join([p.get('medication_name', '') + ' ' + p.get('dosage', '') for p in (v.get('prescription') or [])]) if v.get('prescription') else 'لا توجد وصفة'}""")
    else:
        for v in detail:
            lines.append(f"""📅 Visit: {v.get('created_at', '')[:10] if v.get('created_at') else 'unspecified'}
   Reason: {v.get('reason', 'unspecified')}
   Diagnosis: {v.get('diagnosis', 'unspecified')}
   Vitals: Temp {v.get('temperature', '-')}° | BP {v.get('blood_pressure_systolic', '-')}/{v.get('blood_pressure_diastolic', '-')} | HR {v.get('heart_rate', '-')} | O2 {v.get('oxygen_saturation', '-')}%
   Prescription: {', '.join([p.get('medication_name', '') + ' ' + p.get('dosage', '') for p in (v.get('prescription') or [])]) if v.get('prescription') else 'none'}""")

    if older:
        summary_line = (
            f"[ملخص أقدم: {len(older)} زيارة قبل {cutoff}]"
            if lang_ar else f"[Older summary: {len(older)} visits before {cutoff}]"
        )
        lines.append(summary_line)

    return ("\n\n".join(lines), len(detail))


def ensure_context_fits(
    full_context: str,
    max_tokens: int = DEFAULT_MAX_CONTEXT_TOKENS,
) -> str:
    """If full_context exceeds max_tokens, truncate to fit. Used for single user message."""
    n = count_tokens_openai(full_context)
    if n <= max_tokens:
        return full_context
    return truncate_text_to_tokens(full_context, max_tokens, use_tiktoken=True)
