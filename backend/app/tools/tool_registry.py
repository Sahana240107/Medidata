"""
Tool registry: the JSON schemas the model sees (TOOL_SPECS) and the dispatch
table the agent loop uses to actually run them (TOOL_FUNCTIONS).

Keeping schema + implementation in separate files (this one vs.
analytics_tools.py) means the descriptions here can be tuned purely for
"what will make the model pick the right tool for a given phrasing" without
touching the analytical logic.
"""

from app.tools import analytics_tools as t

TOOL_SPECS = [
    {
        "name": "symptom_frequency",
        "description": (
            "Get the most common symptoms for a disease, with case counts "
            "and percentages. Use for questions like 'most common symptoms "
            "of X', 'what symptoms does X present with', 'how often does X "
            "cause fever'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "disease": {"type": "string", "description": "Disease or syndrome name, as written by the user."},
                "top_n": {"type": "integer", "description": "How many top symptoms to return.", "default": 10},
            },
            "required": ["disease"],
        },
    },
    {
        "name": "medication_frequency",
        "description": (
            "Get the most common medications/drugs recorded for a disease, "
            "with case counts and percentages. Use for open-ended questions "
            "like 'what medications are used for X', 'what drugs treat X', "
            "'what is X treated with'. If the user names two SPECIFIC drugs "
            "to compare (e.g. 'is drug A or drug B better for X'), use "
            "compare_drug_outcomes instead."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "disease": {"type": "string", "description": "Disease or syndrome name, as written by the user."},
                "top_n": {"type": "integer", "description": "How many top medications to return.", "default": 10},
            },
            "required": ["disease"],
        },
    },
    {
        "name": "country_distribution",
        "description": (
            "Get case counts by country for a disease. Use for questions "
            "like 'which countries have the most cases of X', 'geographic "
            "distribution of X'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"disease": {"type": "string"}},
            "required": ["disease"],
        },
    },
    {
        "name": "age_distribution",
        "description": (
            "Get the age-bucket distribution and an approximate average age "
            "for a disease. Use for questions like 'average age of onset "
            "for X', 'what age group does X affect most'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"disease": {"type": "string"}},
            "required": ["disease"],
        },
    },
    {
        "name": "outcome_stats",
        "description": (
            "Get outcome percentages (recovered / deteriorated / unresolved "
            "etc.) for a disease. Use for questions like 'what percentage "
            "of patients recovered from X', 'prognosis for X in this "
            "dataset'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"disease": {"type": "string"}},
            "required": ["disease"],
        },
    },
    {
        "name": "compare_diseases",
        "description": (
            "Compare the symptom profiles of two specific, already-named "
            "diseases: shared symptoms vs. symptoms distinctive to each "
            "one. Use for 'differentiate X from Y', 'how is X different "
            "from Y', 'X vs Y symptoms'. If the user only names ONE "
            "disease and wants to know what else could explain it, use "
            "diseases_that_mimic instead."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "disease_a": {"type": "string"},
                "disease_b": {"type": "string"},
            },
            "required": ["disease_a", "disease_b"],
        },
    },
    {
        "name": "diseases_that_mimic",
        "description": (
            "Rank all other diseases in the dataset by symptom-profile "
            "overlap with one named disease. Use for 'what mimics X', "
            "'what conditions resemble X', 'what could this be confused "
            "with', 'differential diagnosis for X' when only one disease "
            "is named."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "disease": {"type": "string"},
                "top_n": {"type": "integer", "default": 5},
            },
            "required": ["disease"],
        },
    },
    {
        "name": "evidence_search",
        "description": (
            "Vector-search the case dataset using a free-text description "
            "of symptoms/findings (not a disease name) and return the most "
            "similar cases with their matched symptoms and diagnoses. Use "
            "for 'what are the possible diagnoses for [symptom list]', "
            "'why is this diagnosis X', 'which symptoms matched', 'what "
            "evidence supports this diagnosis'. Pass the user's symptom "
            "description (or the diagnosis + context they're asking "
            "about) as query_text."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query_text": {"type": "string", "description": "Free-text symptom description or diagnosis context to search for."},
                "disease": {"type": "string", "description": "Optional — restrict the search to cases of this disease, e.g. when the user asks 'why is this X' and X is known."},
                "top_k": {"type": "integer", "default": 10},
            },
            "required": ["query_text"],
        },
    },
    {
        "name": "compare_drug_outcomes",
        "description": (
            "Compare outcomes between two named drugs/medications within "
            "one disease's cases. Use for 'is drug A or drug B better for "
            "X', 'compare treatment outcomes'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "disease": {"type": "string"},
                "drug_a": {"type": "string"},
                "drug_b": {"type": "string"},
            },
            "required": ["disease", "drug_a", "drug_b"],
        },
    },
]

TOOL_FUNCTIONS = {
    "symptom_frequency": lambda **kw: t.symptom_frequency(**kw),
    "medication_frequency": lambda **kw: t.medication_frequency(**kw),
    "country_distribution": lambda **kw: t.country_distribution(**kw),
    "age_distribution": lambda **kw: t.age_distribution(**kw),
    "outcome_stats": lambda **kw: t.outcome_stats(**kw),
    "compare_diseases": lambda **kw: t.compare_diseases(**kw),
    "diseases_that_mimic": lambda **kw: t.diseases_that_mimic(**kw),
    "evidence_search": lambda **kw: t.evidence_search(**kw),
    "compare_drug_outcomes": lambda **kw: t.compare_drug_outcomes(**kw),
}


def run_tool(name: str, tool_input: dict) -> dict:
    """Dispatch a tool_use block to its implementation, never raising."""
    func = TOOL_FUNCTIONS.get(name)
    if func is None:
        return {"error": f"Unknown tool '{name}'."}
    try:
        return func(**tool_input)
    except TypeError as exc:
        return {"error": f"Bad arguments for '{name}': {exc}"}
    except Exception as exc:  # noqa: BLE001 — surface to the model as a tool error, not a 500
        return {"error": f"Tool '{name}' failed: {exc}"}