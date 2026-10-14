"""Local AI LLM Integration for NyayaBot.

Connects to local Ollama runtime (supporting Llama 3.2, Llama 3.1, DeepSeek-R1)
with delimiter sandboxing, low-temperature legal grounding, and robust deterministic fallback.
"""

from __future__ import annotations

import json
import logging
import re
import urllib.request
from typing import Any, Dict, List, Optional

logger = logging.getLogger("nyayabot.local_llm")

# Ollama local endpoint
OLLAMA_BASE_URL = "http://localhost:11434"

# Preferred model priority hierarchy
DEFAULT_LOCAL_MODEL = "llama3.2:latest"
FALLBACK_LOCAL_MODELS = [
    "llama3.1:latest",
    "deepseek-r1:8b",
    "qwen2.5-coder:7b",
    "Qwen3:8b",
]


def check_ollama_available(timeout: float = 2.0) -> bool:
    """Check if the local Ollama daemon is reachable."""
    try:
        req = urllib.request.Request(f"{OLLAMA_BASE_URL}/api/tags")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status == 200
    except Exception:
        return False


def get_available_local_models(timeout: float = 2.5) -> List[Dict[str, Any]]:
    """Retrieve list of local models installed in Ollama."""
    try:
        req = urllib.request.Request(f"{OLLAMA_BASE_URL}/api/tags")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode())
            models = []
            for m in data.get("models", []):
                models.append({
                    "name": m.get("name"),
                    "size_mb": round(m.get("size", 0) / (1024 * 1024), 1),
                    "family": m.get("details", {}).get("family", "unknown"),
                    "parameter_size": m.get("details", {}).get("parameter_size", "unknown"),
                })
            return models
    except Exception as e:
        logger.warning(f"Could not query Ollama models: {e}")
        return []


def clean_llm_response(text: str) -> str:
    """Clean model output, removing reasoning/thinking tokens (e.g. DeepSeek-R1 <think> tags)."""
    if not text:
        return ""
    # Strip <think>...</think> blocks if present
    cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    # Strip conversational filler prefixes
    cleaned = re.sub(r"^(Here is (a|the) (response|counter-response|rebuttal):\s*)+", "", cleaned.strip(), flags=re.IGNORECASE)
    return cleaned.strip()


def generate_local_chat_completion(
    system_prompt: str,
    user_prompt: str,
    model: str = DEFAULT_LOCAL_MODEL,
    temperature: float = 0.1,
    timeout: float = 20.0,
) -> Optional[str]:
    """Execute local chat completion via Ollama HTTP API with Delimiter Sandboxing."""
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
        "options": {
            "temperature": temperature,
            "top_p": 0.9,
            "num_predict": 256,
        },
    }

    try:
        req = urllib.request.Request(
            f"{OLLAMA_BASE_URL}/api/chat",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status == 200:
                result = json.loads(resp.read().decode("utf-8"))
                content = result.get("message", {}).get("content", "").strip()
                cleaned = clean_llm_response(content)
                if cleaned:
                    return cleaned
    except Exception as e:
        logger.warning(f"Local LLM call to {model} failed or timed out: {e}")

    return None


def generate_adversarial_counter_response(state: Dict[str, Any], model: Optional[str] = None) -> str:
    """Generate legally grounded, adversarial consumer counter-response using local AI.
    
    Uses local model (defaults to llama3.2:latest) with prompt insulation tags (<untrusted_merchant_message>)
    and falls back to deterministic statutory rules if Ollama is unreachable.
    """
    chosen_model = model or DEFAULT_LOCAL_MODEL
    merchant = state.get("merchant_name", "Merchant")
    req_amt = state.get("requested_amount_inr", 0.0)
    floor = state.get("resolution_floor_inr", req_amt * 0.8)
    offer = state.get("latest_offer_inr")
    statutes = state.get("active_statutes") or [
        "Consumer Protection Act 2019 (Section 2(47))",
        "CCPA 2023 Guidelines for Prevention of Dark Patterns",
    ]
    statutes_str = "; ".join(statutes[:3])
    detected_patterns = state.get("detected_dark_patterns") or []
    patterns_str = ", ".join(detected_patterns) if detected_patterns else "Unfair Trade Practice"

    # Get last merchant message from state messages if available
    merchant_msg = "All sales are final as per company policy."
    messages = state.get("messages", [])
    if messages:
        last_msg = messages[-1]
        if hasattr(last_msg, "content"):
            merchant_msg = last_msg.content
        elif isinstance(last_msg, dict) and "content" in last_msg:
            merchant_msg = last_msg["content"]

    system_prompt = (
        "You are NyayaBot, an autonomous legal counter-agent acting on behalf of an aggrieved Indian consumer "
        "in an active commercial dispute chat. Your mandate is to defend the consumer against unfair trade practices, "
        "dark patterns, and unauthorized subscription charges under the Consumer Protection Act, 2019.\n\n"
        "RULES:\n"
        "1. Write directly to the merchant support agent/bot in a firm, professional, uncompromising legal tone.\n"
        "2. Directly cite the relevant statutory provisions provided.\n"
        "3. Demand full refund and immediate revocation of any recurring e-mandates.\n"
        "4. DO NOT provide legal advice warnings or disclaimers. DO NOT mention you are an AI model.\n"
        "5. Output ONLY the counter-response message text to send to the merchant (max 2-3 sentences)."
    )

    user_prompt = (
        f"<dispute_context>\n"
        f"Merchant Legal Name: {merchant}\n"
        f"Claim Amount: ₹{req_amt:,.2f}\n"
        f"Minimum Restitution Floor: ₹{floor:,.2f}\n"
        f"Merchant Latest Offer: {'₹' + f'{offer:,.2f}' if offer else 'None (Refusal/Zero)'}\n"
        f"Statutory Basis: {statutes_str}\n"
        f"Detected Dark Patterns: {patterns_str}\n"
        f"</dispute_context>\n\n"
        f"<untrusted_merchant_message>\n"
        f"{merchant_msg}\n"
        f"</untrusted_merchant_message>\n\n"
        f"Task: Write a firm counter-response to the merchant rejecting their stalling or refusal and demanding full resolution."
    )

    # 1. Attempt generation with chosen local model
    local_output = generate_local_chat_completion(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        model=chosen_model,
        temperature=0.1,
        timeout=18.0,
    )

    if local_output:
        logger.info(f"Generated counter-response using local model {chosen_model}")
        return local_output

    # 2. Try secondary local model if default was unavailable
    for alt_model in FALLBACK_LOCAL_MODELS:
        if alt_model == chosen_model:
            continue
        local_output = generate_local_chat_completion(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            model=alt_model,
            temperature=0.1,
            timeout=18.0,
        )
        if local_output:
            logger.info(f"Generated counter-response using local fallback model {alt_model}")
            return local_output
        break  # Only try one fallback to keep latency reasonable

    # 3. Deterministic Statutory Rule Fallback (zero latency, always reliable)
    logger.info("Using deterministic statutory fallback for counter-response")
    if offer is not None and offer > 0:
        if offer >= floor:
            return (
                f"We note your proposed settlement offer of ₹{offer:,.2f}. The offer has been placed before the consumer "
                f"for formal sign-off. Please confirm that upon acceptance, the recurring e-mandate linked to this account "
                f"will be immediately revoked and written confirmation provided within 24 hours under the {statutes_str}."
            )
        else:
            return (
                f"The partial offer of ₹{offer:,.2f} is unacceptable as it fails to satisfy the statutory restitution floor "
                f"(₹{floor:,.2f}) for the unauthorized charge of ₹{req_amt:,.2f}. Under {statutes_str}, continuing to withhold "
                f"full restitution constitutes a continuing unfair trade practice. We demand immediate reversal of ₹{floor:,.2f} minimum "
                f"to avert formal escalation to the Level 2 Grievance Redressal Officer."
            )
    else:
        return (
            f"Regarding the disputed transaction of ₹{req_amt:,.2f} with {merchant}: under the {statutes_str}, "
            f"unilateral billing without accessible cancellation violates statutory consumer rights. "
            f"We demand full refund of ₹{req_amt:,.2f} to the original payment source and written confirmation of e-mandate cancellation."
        )


def generate_bot_dispute_turn(
    merchant_message: str,
    merchant_name: str = "Merchant",
    requested_amount_inr: float = 2499.0,
    resolution_floor_inr: Optional[float] = None,
    latest_offer_inr: Optional[float] = None,
    dispute_type: str = "subscription_trap",
    preferred_model: Optional[str] = None,
) -> Dict[str, Any]:
    """Complete interactive bot turn execution with local AI, pattern triage, and latency telemetry."""
    import time
    t0 = time.time()
    floor = resolution_floor_inr or (requested_amount_inr * 0.8)
    model = preferred_model or DEFAULT_LOCAL_MODEL

    # 1. Pattern Detection via regex
    detected_patterns = []
    if re.search(r"\b(call us|call our support|phone|helpline|cannot cancel online|terms require phone)\b", merchant_message, re.IGNORECASE):
        detected_patterns.append("CCPA Annexure 1(5): Subscription Trap (Forced phone call to cancel)")
    if re.search(r"\b(non-refundable|cannot refund|strict policy|final sale|no refund under any condition)\b", merchant_message, re.IGNORECASE):
        detected_patterns.append("CPA Sec 2(47): Unfair Trade Practice (Categorical refund refusal)")
    if re.search(r"\b(processing fee|convenience fee|cancellation fee|maintenance surcharge)\b", merchant_message, re.IGNORECASE):
        detected_patterns.append("CCPA Annexure 1(8): Drip Pricing (Unilateral deduction fee)")
    if re.search(r"\b(store credit|coupon|points|wallet|voucher)\b", merchant_message, re.IGNORECASE):
        detected_patterns.append("CCPA Annexure 1(4): Interface Interference (Forced credit over currency refund)")
    if not detected_patterns:
        detected_patterns.append("Unfair Trade Practice (Consumer Protection Act 2019)")

    # 2. Extract any offer in merchant message
    offer_match = re.search(r"(?:refund|settle|credit|offer|pay)\s+(?:of\s+)?(?:INR|Rs\.?|₹)?\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?)", merchant_message, re.IGNORECASE)
    if offer_match and latest_offer_inr is None:
        try:
            latest_offer_inr = float(offer_match.group(1).replace(",", ""))
        except ValueError:
            pass

    # 3. Compile statutes
    statutes = [
        "Consumer Protection Act 2019 (Section 2(47))",
        "CCPA 2023 Guidelines for Prevention of Dark Patterns",
    ]
    if "subscription" in dispute_type.lower() or "mandate" in dispute_type.lower():
        statutes.append("RBI 2019/2026 E-Mandate Regulatory Framework (Mandatory Pre-Debit Notice)")

    # 4. Generate AI counter-response
    state = {
        "merchant_name": merchant_name,
        "requested_amount_inr": requested_amount_inr,
        "resolution_floor_inr": floor,
        "latest_offer_inr": latest_offer_inr,
        "active_statutes": statutes,
        "detected_dark_patterns": detected_patterns,
        "messages": [{"sender": "merchant", "content": merchant_message}],
    }

    response_text = generate_adversarial_counter_response(state, model=model)
    latency_ms = round((time.time() - t0) * 1000)

    # 5. Determine recommended next action
    if latest_offer_inr and latest_offer_inr >= requested_amount_inr:
        next_action = "ACCEPT_FULL_SETTLEMENT"
        advice = "Merchant has offered full restitution. Request immediate transaction reference number and mandate cancellation receipt."
    elif latest_offer_inr and latest_offer_inr >= floor:
        next_action = "AWAITING_HITL_DECISION"
        advice = f"Merchant offered partial restitution of ₹{latest_offer_inr:,.2f} (above floor of ₹{floor:,.2f}). Requires consumer approval."
    else:
        next_action = "ASSERT_STATUTORY_COUNTER"
        advice = "Merchant maintains stalling/deflection or an unacceptable offer. Transmit statutory counter-argument demanding full refund."

    return {
        "response_text": response_text,
        "model_used": model,
        "latency_ms": latency_ms,
        "detected_dark_patterns": detected_patterns,
        "statutory_citations": statutes,
        "restitution_demanded_inr": requested_amount_inr,
        "resolution_floor_inr": floor,
        "detected_offer_inr": latest_offer_inr,
        "recommended_next_action": next_action,
        "strategic_advice": advice,
        "is_local_ai": True,
    }
