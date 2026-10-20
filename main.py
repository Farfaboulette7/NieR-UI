import decky


class Plugin:
    # Pas de backend pour l'instant : l'interface est entièrement côté frontend.
    async def _main(self):
        decky.logger.info("NieRDeck chargé")

    async def _unload(self):
        decky.logger.info("NieRDeck déchargé")
