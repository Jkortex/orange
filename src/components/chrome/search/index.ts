export type {
  SearchScope,
  SearchMode as SearchModeType,
  Result,
  CommandItem,
  SymbolItem,
  CategoryItem,
} from './types'
export { buildCommands, filterCommands } from './commands'
export {
  BASE_CATEGORIES,
  filterCategories,
  scanPageHeadings,
  filterSymbols,
} from './categories'
export {
  CommandMode,
  CategoryMode,
  SymbolMode,
  SearchMode,
  jumpToHeading,
} from './modes'
