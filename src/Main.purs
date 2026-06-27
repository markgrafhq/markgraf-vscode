module Main
  ( ExtensionContext
  , activate
  , deactivate
  ) where

import Prelude

import Effect (Effect)
import Effect.Uncurried (EffectFn1, EffectFn2, mkEffectFn1, runEffectFn2)

foreign import data ExtensionContext :: Type

activate :: EffectFn1 ExtensionContext Unit
activate = mkEffectFn1 \context -> runEffectFn2 activateImpl extensionConfig context

deactivate :: Effect Unit
deactivate = runEffectFn2 deactivateImpl unit unit

type ExtensionConfig =
  { languageId :: String
  , serverName :: String
  , serverCommandSetting :: String
  , serverRuntimeSetting :: String
  , previewCommand :: String
  , previewTitle :: String
  }

extensionConfig :: ExtensionConfig
extensionConfig =
  { languageId: "markgraf"
  , serverName: "Markgraf Language Server"
  , serverCommandSetting: "markgraf.serverCommand"
  , serverRuntimeSetting: "markgraf.serverRuntime"
  , previewCommand: "markgraf.preview"
  , previewTitle: "Markgraf: Preview"
  }

foreign import activateImpl :: EffectFn2 ExtensionConfig ExtensionContext Unit
foreign import deactivateImpl :: EffectFn2 Unit Unit Unit
