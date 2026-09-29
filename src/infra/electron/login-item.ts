import { app } from 'electron'
import type { LoginItem } from '@application/ports/system'

export const electronLoginItem: LoginItem = {
    setOpenAtLogin: (enabled) => app.setLoginItemSettings({ openAtLogin: enabled })
}
