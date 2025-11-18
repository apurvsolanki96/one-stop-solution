
def build_prompt(task, notam_text):
    notam_text = notam_text.strip()

    if task == "explain":
        return f"""
You are an aviation NOTAM expert. Explain the following NOTAM clearly, in human-friendly language.
Avoid assumptions. Follow ICAO phrasing.

NOTAM:
{notam_text}
"""

    if task == "simplify":
        return f"""
Rewrite the NOTAM in simpler terms while preserving all operational restrictions:
- Route closures
- Times
- Flight levels
- Areas affected
- Vertical limits

NOTAM:
{notam_text}
"""

    if task == "risk":
        return f"""
Assess the operational risk of the NOTAM for IFR traffic. Consider:
- Route impact
- FL restrictions
- Geographic relevance
- Potential diversions
- Sector workload

Output format:
RISK: <Low/Medium/High>
REASON: <short explanation>

NOTAM:
{notam_text}
"""

    if task == "super":
        return f"""
You are an advanced NOTAM interpretation engine.

Goals:
1. Identify all route closures
2. Identify all affected waypoints
3. Extract FL restrictions
4. Summarize operational impact
5. Produce structured JSON with:
   - routes
   - segments
   - fl_min / fl_max
   - explanation

NOTAM:
{notam_text}
"""

    return f"ERROR: Unknown task '{task}'"
