"""Authoritative statutory legal and dark-pattern index.

Contains verified provisions from:
- Consumer Protection Act, 2019 (Act No. 35 of 2019)
- CCPA Guidelines for Prevention and Regulation of Dark Patterns, 2023
- RBI Master Directions on E-Mandates for Recurring Transactions
- Consumer Protection (E-Commerce) Rules, 2020

Every record maintains verified source text, authority, section/annexure metadata, and applicability notes.
"""

from __future__ import annotations

from typing import Any, Dict, List

STATUTORY_CORPUS: List[Dict[str, Any]] = [
    {
        "id": "cpa-2-47",
        "source_name": "Consumer Protection Act, 2019",
        "act_or_regulation": "Act No. 35 of 2019",
        "issuing_authority": "Parliament of India / Ministry of Consumer Affairs",
        "section_or_annexure": "Section 2(47)",
        "effective_date": "2020-07-20",
        "category": "Unfair Trade Practice",
        "retrieved_text": (
            "A trade practice which, for the purpose of promoting the sale, use or supply of any goods "
            "or for the provision of any service, adopts any unfair method or deceptive practice including "
            "false representation, misleading warranty, or failure to disclose material terms."
        ),
        "relevance_explanation": (
            "Directly applies to merchants withholding cancellation terms, charging after explicit opt-out requests, "
            "or disguising recurring billing."
        ),
        "severity": "high",
        "dark_pattern_code": "CPA_UTP_01",
        "keywords": ["unfair trade practice", "deceptive", "cancellation", "recurring", "misleading", "refund"],
    },
    {
        "id": "cpa-2-9",
        "source_name": "Consumer Protection Act, 2019",
        "act_or_regulation": "Act No. 35 of 2019",
        "issuing_authority": "Parliament of India / Ministry of Consumer Affairs",
        "section_or_annexure": "Section 2(9)",
        "effective_date": "2020-07-20",
        "category": "Consumer Rights",
        "retrieved_text": (
            "The right to be informed about the quality, quantity, potency, purity, standard and price of goods "
            "or services; the right to seek redressal against unfair trade practices or restrictive trade practices "
            "or unscrupulous exploitation."
        ),
        "relevance_explanation": (
            "Empowers consumers to dispute automatic debits executed without clear upfront disclosure or accessible cancellation."
        ),
        "severity": "medium",
        "dark_pattern_code": "CPA_RIGHTS_02",
        "keywords": ["consumer rights", "right to information", "redressal", "exploitation", "disclosure"],
    },
    {
        "id": "ccpa-dp-annexure-5",
        "source_name": "Guidelines for Prevention and Regulation of Dark Patterns, 2023",
        "act_or_regulation": "CCPA Notification No. F. No. J-25/11/2023-CCPA",
        "issuing_authority": "Central Consumer Protection Authority (CCPA)",
        "section_or_annexure": "Annexure 1(5)",
        "effective_date": "2023-11-30",
        "category": "Subscription Trap",
        "retrieved_text": (
            "The practice of making cancellation of a paid subscription impossible or a complex and lengthy process, "
            "including hiding the cancellation option, forcing consumers to provide unnecessary payment details, "
            "or requiring a phone call/chat when sign-up was completely online."
        ),
        "relevance_explanation": (
            "Primary dark pattern cited when merchants refuse instant in-app/web cancellation or impose deflection loops."
        ),
        "severity": "critical",
        "dark_pattern_code": "DP_SUBSCRIPTION_TRAP",
        "keywords": ["subscription trap", "cancel", "cancellation", "hiding cancel", "renewal", "automatic debit"],
    },
    {
        "id": "ccpa-dp-annexure-6",
        "source_name": "Guidelines for Prevention and Regulation of Dark Patterns, 2023",
        "act_or_regulation": "CCPA Notification No. F. No. J-25/11/2023-CCPA",
        "issuing_authority": "Central Consumer Protection Authority (CCPA)",
        "section_or_annexure": "Annexure 1(6)",
        "effective_date": "2023-11-30",
        "category": "Interface Interference",
        "retrieved_text": (
            "Design element that manipulates the user interface in ways that point the user towards actions favorable "
            "to the platform and away from consumer-friendly actions, such as visually deemphasizing cancel buttons "
            "or making rejection options obscure."
        ),
        "relevance_explanation": (
            "Covers asymmetric UI where upgrading takes 1 click but cancelling requires multiple confirmations, warnings, and delays."
        ),
        "severity": "high",
        "dark_pattern_code": "DP_INTERFACE_INTERFERENCE",
        "keywords": ["interface interference", "deemphasize", "hidden button", "obscure", "dark pattern"],
    },
    {
        "id": "ccpa-dp-annexure-8",
        "source_name": "Guidelines for Prevention and Regulation of Dark Patterns, 2023",
        "act_or_regulation": "CCPA Notification No. F. No. J-25/11/2023-CCPA",
        "issuing_authority": "Central Consumer Protection Authority (CCPA)",
        "section_or_annexure": "Annexure 1(8)",
        "effective_date": "2023-11-30",
        "category": "Drip Pricing",
        "retrieved_text": (
            "A practice whereby elements of prices are not revealed upfront or are revealed incrementally across the "
            "purchase process, or recurring charges are concealed during initial trial signup."
        ),
        "relevance_explanation": (
            "Applicable when recurring debits exceed the advertised subscription tier or hide maintenance/service surcharges."
        ),
        "severity": "high",
        "dark_pattern_code": "DP_DRIP_PRICING",
        "keywords": ["drip pricing", "hidden fees", "trial charge", "unrevealed price", "extra debit"],
    },
    {
        "id": "ccpa-dp-annexure-2",
        "source_name": "Guidelines for Prevention and Regulation of Dark Patterns, 2023",
        "act_or_regulation": "CCPA Notification No. F. No. J-25/11/2023-CCPA",
        "issuing_authority": "Central Consumer Protection Authority (CCPA)",
        "section_or_annexure": "Annexure 1(2)",
        "effective_date": "2023-11-30",
        "category": "False Urgency",
        "retrieved_text": (
            "Falsely stating or implying the sense of urgency or scarcity to mislead a user into making an immediate purchase "
            "or taking an immediate action."
        ),
        "relevance_explanation": (
            "Used by platforms to induce rushed sign-ups or deter users from opting out by creating false expiration alarms."
        ),
        "severity": "medium",
        "dark_pattern_code": "DP_FALSE_URGENCY",
        "keywords": ["false urgency", "countdown", "only 2 left", "hurry", "scarcity"],
    },
    {
        "id": "rbi-emandate-2019",
        "source_name": "RBI Framework on Processing of e-Mandates on Cards/UPI",
        "act_or_regulation": "RBI/2019-20/47 DPSS.CO.PD.No.447/02.14.003/2019-20",
        "issuing_authority": "Reserve Bank of India (RBI)",
        "section_or_annexure": "Clause 3(a)-(e)",
        "effective_date": "2019-08-21",
        "category": "E-Mandate Compliance",
        "retrieved_text": (
            "The issuer shall send a pre-debit notification to the cardholder at least 24 hours prior to the actual charge debit date. "
            "The facility to withdraw or revoke the e-mandate shall be provided through an online dashboard with immediate execution."
        ),
        "relevance_explanation": (
            "Mandatory financial regulation. Debits executed without a 24-hour pre-debit SMS/email or where merchant fails to acknowledge "
            "mandate revocation are voidable through banking dispute."
        ),
        "severity": "critical",
        "dark_pattern_code": "RBI_EMANDATE_VIOLATION",
        "keywords": ["e-mandate", "pre-debit notice", "24 hours", "recurring transaction", "revocation", "cardholder"],
    },
    {
        "id": "ecom-rules-rule-5",
        "source_name": "Consumer Protection (E-Commerce) Rules, 2020",
        "act_or_regulation": "Ministry of Consumer Affairs Notification G.S.R. 458(E)",
        "issuing_authority": "Ministry of Consumer Affairs",
        "section_or_annexure": "Rule 5(3)",
        "effective_date": "2020-07-23",
        "category": "Grievance Redressal",
        "retrieved_text": (
            "Every e-commerce entity shall establish an adequate grievance redressal mechanism and appoint a Grievance Officer, "
            "publishing their name and contact details prominently. The grievance officer must acknowledge receipt within 48 hours "
            "and redress the complaint within one month."
        ),
        "relevance_explanation": (
            "Sets statutory timeline for Level 2 escalations. Establishes legal duty of the Grievance Redressal Officer (GRO)."
        ),
        "severity": "medium",
        "dark_pattern_code": "ECOM_GRO_STATUTE",
        "keywords": ["grievance officer", "gro", "48 hours", "e-commerce rules", "redressal", "acknowledgment"],
    },
]
