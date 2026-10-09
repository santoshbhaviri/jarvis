// src/lib/taskActions.js
// Shared task actions (focus star, follow-up chased, open editor) so every
// TaskCard can offer them without threading props through each tab.
import { createContext, useContext } from 'react'

export const TaskActionsContext = createContext({})
export const useTaskActions = () => useContext(TaskActionsContext)
