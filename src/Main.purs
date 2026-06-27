module Main
  ( ExtensionContext
  , activate
  , deactivate
  ) where

import Prelude

import Effect (Effect)
import Effect.Uncurried (EffectFn2, runEffectFn2)

foreign import data ExtensionContext :: Type

activate :: ExtensionContext -> Effect Unit
activate = runEffectFn2 activateImpl serverConfig

deactivate :: Effect Unit
deactivate = runEffectFn2 deactivateImpl unit unit

type ServerConfig =
  { languageId :: String
  , serverName :: String
  , serverCommandSetting :: String
  , serverRuntimeSetting :: String
  }

serverConfig :: ServerConfig
serverConfig =
  { languageId: "markgraf"
  , serverName: "Markgraf Language Server"
  , serverCommandSetting: "markgraf.serverCommand"
  , serverRuntimeSetting: "markgraf.serverRuntime"
  }

foreign import activateImpl :: EffectFn2 ServerConfig ExtensionContext Unit
foreign import deactivateImpl :: EffectFn2 Unit Unit Unit
