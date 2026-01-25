# Weekly Progress Report

**Week of January 20-25, 2026**

---

## Thursday, January 23

The week began with establishing project documentation and developer onboarding materials. A comprehensive CLAUDE.md file was created containing project setup instructions, Snowflake configuration details (including the critical account identifier format with region suffix), and authentication method options for local development.

**Value Add:** New developers can now onboard to the project independently with clear setup instructions, reducing ramp-up time and preventing common configuration errors.

---

## Friday, January 24

Friday was the most productive day of the week with 16 commits spanning major feature development, bug fixes, and documentation updates.

### Architecture & Core Features

The day started with implementing the hierarchical DataTable component with CBS_HIERARCHY-based expand/collapse functionality and the spend analysis chart with dual-axis visualization (bar chart for period spend, line chart for cumulative). This was followed by a major architectural shift to a chatbot-first interface, implementing the northstar.bd design pattern with an AI-powered cost analysis assistant.

The backend API was enhanced with chat streaming capabilities, and the frontend received significant UI polish including voice input/output support, inline chart generation, and executive summary features. Performance metrics (PF/CF) were added along with an upgrade to GPT-5.2 for improved analysis quality.

### Bug Fixes & Data Integrity

Several critical bugs were addressed:
- **Triple-counting fix**: Cost aggregation was incorrectly summing child CBS rows that were already included in parent totals. Fixed by filtering to ROOT-level rows only (empty CBS_HIERARCHY) for all aggregations.
- **Snowflake string handling**: Numeric values from Snowflake arrive as strings, causing `.toFixed()` to fail. All formatters now use `parseFloat()` first.
- **DataTable footer**: Rewrote to use dynamic column iteration, preventing column count mismatches.

### Chat Enhancements

The chat interface received major improvements:
- Added user/assistant avatars with timestamps
- Implemented loading skeleton with shimmer animation
- Fixed markdown preprocessing to properly render headers, lists, and tables
- Added FTE calculation domain knowledge to the system prompt
- Included manhours data (JTD_MH, PER_MH) in the AI context for workforce analysis

**Value Add:** Users now have a professional, AI-powered interface for analyzing cost data with natural language queries. Data integrity issues have been resolved, ensuring accurate financial reporting. The chat can now answer questions about FTE and labor costs.

---

## Saturday, January 25

The week concluded with adding comprehensive FTE calculations to the AI context. The system now computes Monthly FTE, Weekly FTE, and Average Hourly Rate using a 4-4-5 financial calendar pattern. A summary row with totals and averages was also added to the period table.

**Value Add:** Project managers can now ask the AI about staffing levels and labor rates, receiving accurate FTE calculations based on actual manhours data.

---

## Weekly Summary

| Day | Theme | Key Deliverables |
|-----|-------|------------------|
| Thursday | Documentation | CLAUDE.md setup guide, Snowflake configuration |
| Friday | Core Development | Hierarchical DataTable, Chat interface, Triple-counting fix, Avatars/timestamps |
| Saturday | Analytics | FTE calculations with 4-4-5 calendar |

**Total Commits:** 18

**Key Achievements:**
- Transitioned to chatbot-first architecture
- Implemented hierarchical cost breakdown visualization
- Fixed critical data aggregation bug (triple-counting)
- Added FTE/labor analytics capabilities
- Enhanced chat UI with professional design elements
