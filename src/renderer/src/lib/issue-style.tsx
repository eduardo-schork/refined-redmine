import { createContext, useContext } from 'react'
import { DEFAULT_ISSUE_STYLE, type IssueStyleRules } from '@domain/redmine/issue-style'

/** Status colors, priority levels and the "due soon" window, from the settings (provided in App). */
export const IssueStyleContext = createContext<IssueStyleRules>(DEFAULT_ISSUE_STYLE)

export const useIssueStyle = () => useContext(IssueStyleContext)
