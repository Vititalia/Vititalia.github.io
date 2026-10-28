Here is the English translation:

The project must manage a warehouse (database table `lotti_magazzino`) where several growers (a closed list of members: Mori Marco; Donati; Agriserv; Vivai riuniti; Bianchi; Golferenzo; Lorin; Esterno) deliver their materials into a warehouse (`ordini_impegni`).

Both tables process different product types (specified in the database structure) and different production methods (specified in the database structure).

There are also two master data tables (`anagrafica vite` [grapevine master data] and `anagrafica portainnesto` [rootstock master data]).

Data entry into the warehouse and orders tables must be validated against the master data:

* Variety codes must be constrained by their existence in the master data.
* Clone codes will depend on the selected variety.
* Rootstock codes must be constrained by the rootstock master data.

The application requires 4 user profiles/roles:

* **Admin profile:** allows creating and modifying forms/screens, entering values, and viewing tables.
* **Administration profile:** allows data entry of produced quantities via a user-friendly interface or by uploading an Excel file into `lotti_magazzino` and `ordini_impegni`, as well as viewing output tables.
* **Grower profile:** view-only access to output tables.
* **Sales/Commercial profile:** view-only access to output tables (a restricted subset).

The required output tables to create are:

* **AVAILABILITY SUMMARY (RIEPILOGO DISPONIBILITA):**
A table based on the `riepilogo_disponibilità` view showing: quantities entered into the warehouse, ordered quantities, shipped quantities from orders ("of which shipped", where `spedito = TRUE`), and availability (calculated as: warehouse quantity − ordered quantity).
* Filters at the top: Type (`Tipologia`), Production Method (`Produzione`), and Variety Code (`codice_varietà`). These must be single-select dropdown menus, with search enabled for `codice_varietà`.
* Data display: Grouped/displayed by Clone Code (`codice_clone`), Rootstock Code (`codice_portainnesto`), and the specified quantities.
* Sorting: Ordered by rootstock code.
* Subtotals: A subtotal row summing values grouped by rootstock, displaying "Total for rootstock" in place of the clone code along with the rootstock code. These subtotal rows must be styled in bold with a distinct background color.
* Alerts: Any negative availability values must highlight the entire row in bold red.


* **AVAILABILITY SUMMARY BY GROWER (RIEPILOGO DISPONIBILITA PER PRODUTTORE):**
An output table structured like the Availability Summary, but breaking down the available stock into individual columns per grower.
* Filters at the top: Type (`Tipologia`), Production Method (`Produzione`), and Variety Code (`codice_varietà`) using single-select dropdowns (searchable for `codice_varietà`).
* Data display: Displayed by `codice_clone`, `codice_portainnesto`, and the respective quantities.
* Sorting: Ordered by rootstock code.
* Subtotals: A subtotal row per rootstock showing "Total for rootstock" instead of the clone code, displayed in bold with a different background color.
* Alerts: Negative availability values must highlight the entire row in bold red.


* **UNAVAILABILITY / SHORTAGES (INDISPONIBILITA):**
An output table displaying warehouse quantities, produced quantities, and requested/deficit quantities (calculated as: warehouse quantity − ordered quantity; showing only records where this calculation yields a negative value) broken down by Type, Production Method, Variety Code, Clone Code, and Rootstock Code.
* Sorting: Ordered by variety code, rootstock code, clone code.



All output tables must be fully responsive across smartphones, tablets, and PCs. Data entry screens/tables only need to support PC access.

Visibility Permissions:

Availability Summary by Grower: visible only to Admin and Administration profiles.

Availability Summary: visible to all profiles.

Unavailability / Shortages: visible to Admin, Administration, and Grower profiles.
