# Calc LLC

A comprehensive, web-based companion app and theorycrafting calculator for the game. Built with Svelte 5 and SvelteKit, this tool allows players to import their save files, simulate loadouts, calculate exact mining DPS, and plan their economy.

## Features

- **Dynamic DPS Calculator**: Build custom loadouts using your held weapons, independent background sources (like bombs or drill employees), and status modifiers. Instantly calculate Time-to-Kill (TTK) and yield ranges against various mineral layers.
- **Save File Integration**: Seamlessly upload your game's save file. The app parses your cash, current day, inventory, hired employees, passive multipliers, and bonus equipment unlocks directly from the save data.
- **Interactive Shops**: Simulate equipment purchases with a custom quantity modal, and unlock permanent side-effects through the dedicated Bonus Shop.
- **Advanced Filtering**: Filter calculator tables dynamically by specific block layers or material types to focus on the exact loot you are grinding for.
- **Passives & Org Chart**: Tweak your global passive multipliers and visualize your hierarchical employee promotions and upgrades.

## Tech Stack

- **Framework**: SvelteKit
- **UI & Reactivity**: Svelte 5 (utilizing modern Runes like $state and $derived)
- **Styling**: Tailwind CSS

## Docker/Podman for Local Development

If you prefer to keep your host machine clean without installing Node.js or npm, you can run the entire development environment through Docker or podman.

## Contributing

Contributions are welcome. If you find a discrepancy in DPS calculations or want to add new feature trackers, feel free to open an Issue or submit a Pull Request.

## License

Game assets such as mining equipment, players and resources are property of Coal LLC's creator [ByeByeOcean](https://www.byebyeocean.net/)

Code is under "THE BEER-WARE LICENSE" (Revision 42):

As long as you retain this notice you can do whatever you want with this stuff. If we meet some day, and you think this stuff is worth it, you can buy me a beer in return.
