/**
 * Mock-world fixtures: Shopify order-export CSVs (fed through the REAL
 * importer at seed time) and a fake HubSpot contact directory.
 *
 * The Falling Light export is deliberately messy in the ways real exports
 * are: multi-line-item orders with blank continuation rows, collector names
 * containing commas, a missing email, unrelated line items (tote bags) mixed
 * into the file, an exact duplicate row, and an order with no billing or
 * shipping name. If the screens survive this file, they'll survive the real
 * thing. All people and emails are fictional.
 */

const HEADER =
  'Name,Email,Financial Status,Paid at,Fulfillment Status,Currency,Subtotal,Created at,Lineitem quantity,Lineitem name,Lineitem price,Lineitem sku,Billing Name,Shipping Name,Shipping Country,Tags';

export const FALLING_LIGHT_CSV = `${HEADER}
#AA10412,jane.whitfield@example.com,paid,2026-03-12 09:14:02 +0000,unfulfilled,GBP,540.00,2026-03-12 09:14:02 +0000,1,Falling Light - Framed,540.00,FL-FR,Jane Whitfield,Jane Whitfield,United Kingdom,
#AA10413,marcus.oduya@example.com,paid,2026-03-12 09:21:44 +0000,unfulfilled,GBP,380.00,2026-03-12 09:21:44 +0000,1,Falling Light - Unframed,380.00,FL-UF,Marcus Oduya,Marcus Oduya,United Kingdom,vip
#AA10415,chidi.okafor@example.org,paid,2026-03-12 09:40:11 +0000,unfulfilled,GBP,380.00,2026-03-12 09:40:11 +0000,1,Falling Light - Unframed,380.00,FL-UF,"Okafor, Chidi","Okafor, Chidi",United Kingdom,repeat-collector
#AA10416,sofia.lindqvist@example.com,paid,2026-03-12 10:02:53 +0000,unfulfilled,GBP,540.00,2026-03-12 10:02:53 +0000,1,Falling Light - Framed,540.00,FL-FR,Sofia Lindqvist,Sofia Lindqvist,United Kingdom,
#AA10418,priya.raman@example.com,paid,2026-03-12 10:15:37 +0000,unfulfilled,GBP,920.00,2026-03-12 10:15:37 +0000,1,Falling Light - Framed,540.00,FL-FR,Priya Raman,Priya Raman,United Kingdom,first-order
,,,,,,,,1,Falling Light - Unframed,380.00,FL-UF,,,,
#AA10419,daan.vermeer@example.com,paid,2026-03-12 10:44:09 +0000,unfulfilled,EUR,620.00,2026-03-12 10:44:09 +0000,1,Falling Light - Framed,540.00,FL-FR,Daan Vermeer,Daan Vermeer,Netherlands,"vip,framed-upgrade"
#AA10421,,paid,2026-03-12 11:03:26 +0000,unfulfilled,GBP,380.00,2026-03-12 11:03:26 +0000,1,Falling Light - Unframed,380.00,FL-UF,Harriet Boyle,Harriet Boyle,United Kingdom,
#AA10422,ines.moreau@example.com,paid,2026-03-12 11:19:48 +0000,unfulfilled,EUR,540.00,2026-03-12 11:19:48 +0000,1,Falling Light - Framed,540.00,FL-FR,Inès Moreau,Inès Moreau,France,repeat-collector
#AA10424,felix.brand@example.com,paid,2026-03-12 11:31:02 +0000,unfulfilled,GBP,45.00,2026-03-12 11:31:02 +0000,1,Falling Light Tote Bag,45.00,FL-TOTE,Felix Brand,Felix Brand,United Kingdom,
#AA10425,amara.diallo@example.com,paid,2026-03-12 12:00:31 +0000,unfulfilled,GBP,540.00,2026-03-12 12:00:31 +0000,1,Falling Light - Framed,540.00,FL-FR,Amara Diallo,Amara Diallo,United Kingdom,vip
#AA10427,noah.gallagher@example.org,paid,2026-03-12 12:26:55 +0000,unfulfilled,GBP,425.00,2026-03-12 12:26:55 +0000,1,Falling Light - Unframed,380.00,FL-UF,Noah Gallagher,Noah Gallagher,United Kingdom,repeat-collector
,,,,,,,,1,Falling Light Tote Bag,45.00,FL-TOTE,,,,
#AA10412,jane.whitfield@example.com,paid,2026-03-12 09:14:02 +0000,unfulfilled,GBP,540.00,2026-03-12 09:14:02 +0000,1,Falling Light - Framed,540.00,FL-FR,Jane Whitfield,Jane Whitfield,United Kingdom,
#AA10428,yuki.tanaka@example.com,paid,2026-03-13 08:12:19 +0000,unfulfilled,GBP,540.00,2026-03-13 08:12:19 +0000,1,Falling Light - Framed,540.00,FL-FR,Yuki Tanaka,Yuki Tanaka,United Kingdom,first-order
#AA10430,lars.petersen@example.net,paid,2026-03-13 09:47:33 +0000,unfulfilled,GBP,380.00,2026-03-13 09:47:33 +0000,1,Falling Light - Unframed,380.00,FL-UF,,,United Kingdom,"vip,framed-upgrade"
#AA10431,greta.hoffmann@example.com,paid,2026-03-13 10:29:56 +0000,unfulfilled,EUR,540.00,2026-03-13 10:29:56 +0000,1,Falling Light - Framed,540.00,FL-FR,Greta Hoffmann,Greta Hoffmann,Germany,
#AA10433,tom.rivera@example.net,paid,2026-03-13 11:52:40 +0000,unfulfilled,USD,540.00,2026-03-13 11:52:40 +0000,1,Falling Light - Framed,540.00,FL-FR,Tom Rivera,Tom Rivera,United States,repeat-collector
#AA10434,alice.ngata@example.com,paid,2026-03-14 07:58:03 +0000,unfulfilled,GBP,380.00,2026-03-14 07:58:03 +0000,1,Falling Light - Unframed,380.00,FL-UF,Alice Ngata,Alice Ngata,United Kingdom,
#AA10436,ben.osei@example.com,paid,2026-03-14 09:36:27 +0000,unfulfilled,GBP,540.00,2026-03-14 09:36:27 +0000,1,Falling Light - Framed,540.00,FL-FR,Ben Osei,Ben Osei,United Kingdom,vip
#AA10437,clara.jimenez@example.org,paid,2026-03-14 10:41:50 +0000,unfulfilled,EUR,380.00,2026-03-14 10:41:50 +0000,1,Falling Light - Unframed,380.00,FL-UF,"Jiménez, Clara","Jiménez, Clara",Italy,repeat-collector
#AA10439,oliver.hart@example.com,paid,2026-03-15 08:22:14 +0000,unfulfilled,GBP,540.00,2026-03-15 08:22:14 +0000,1,Falling Light - Framed,540.00,FL-FR,Oliver Hart,Oliver Hart,United Kingdom,
#AA10440,maja.kowalska@example.com,paid,2026-03-15 09:55:38 +0000,unfulfilled,EUR,540.00,2026-03-15 09:55:38 +0000,1,Falling Light - Framed,540.00,FL-FR,Maja Kowalska,Maja Kowalska,Spain,first-order
#AA10442,ethan.brooks@example.com,paid,2026-03-16 11:08:01 +0000,unfulfilled,USD,380.00,2026-03-16 11:08:01 +0000,1,Falling Light - Unframed,380.00,FL-UF,Ethan Brooks,Ethan Brooks,United States,"vip,framed-upgrade"
#AA10443,nadia.hassan@example.com,paid,2026-03-17 12:33:25 +0000,unfulfilled,GBP,540.00,2026-03-17 12:33:25 +0000,1,Falling Light - Framed,540.00,FL-FR,Nadia Hassan,Nadia Hassan,United Kingdom,
#AA10445,leo.marchetti@example.org,paid,2026-03-18 13:47:49 +0000,unfulfilled,EUR,380.00,2026-03-18 13:47:49 +0000,1,Falling Light - Unframed,380.00,FL-UF,Leo Marchetti,Leo Marchetti,Poland,repeat-collector
#AA10446,freya.dunbar@example.com,paid,2026-03-19 14:59:12 +0000,unfulfilled,GBP,540.00,2026-03-19 14:59:12 +0000,1,Falling Light - Framed,540.00,FL-FR,Freya Dunbar,Freya Dunbar,United Kingdom,
#AA10448,william.acheampong@example.com,paid,2026-03-20 16:04:36 +0000,unfulfilled,GBP,380.00,2026-03-20 16:04:36 +0000,1,Falling Light - Unframed,380.00,FL-UF,William Acheampong,William Acheampong,United Kingdom,vip
#AA10449,rosa.delgado@example.com,paid,2026-03-21 17:18:59 +0000,unfulfilled,EUR,540.00,2026-03-21 17:18:59 +0000,1,Falling Light - Framed,540.00,FL-FR,Rosa Delgado,Rosa Delgado,Netherlands,repeat-collector
`;

export const VESSEL_VIII_CSV = `${HEADER}
#AA10501,imogen.clarke@example.com,paid,2026-04-02 09:10:00 +0100,unfulfilled,GBP,2400.00,2026-04-02 09:10:00 +0100,1,Vessel VIII,2400.00,V8,Imogen Clarke,Imogen Clarke,United Kingdom,
#AA10502,henrik.dahl@example.com,paid,2026-04-02 09:32:00 +0100,unfulfilled,EUR,2400.00,2026-04-02 09:32:00 +0100,1,Vessel VIII,2400.00,V8,Henrik Dahl,Henrik Dahl,France,first-order
#AA10503,mei.wong@example.org,paid,2026-04-02 10:05:00 +0100,unfulfilled,GBP,2400.00,2026-04-02 10:05:00 +0100,1,Vessel VIII,2400.00,V8,Mei Wong,Mei Wong,United Kingdom,"vip,framed-upgrade"
#AA10504,arthur.beaumont@example.net,paid,2026-04-02 10:41:00 +0100,unfulfilled,GBP,2400.00,2026-04-02 10:41:00 +0100,1,Vessel VIII,2400.00,V8,Arthur Beaumont,Arthur Beaumont,United Kingdom,
#AA10505,lucia.ferrari@example.com,paid,2026-04-02 11:20:00 +0100,unfulfilled,EUR,2400.00,2026-04-02 11:20:00 +0100,1,Vessel VIII,2400.00,V8,Lucia Ferrari,Lucia Ferrari,Germany,repeat-collector
#AA10506,jonas.weber@example.com,paid,2026-04-03 08:15:00 +0100,unfulfilled,EUR,2400.00,2026-04-03 08:15:00 +0100,1,Vessel VIII,2400.00,V8,Jonas Weber,Jonas Weber,Italy,
#AA10507,sarah.mbeki@example.com,paid,2026-04-03 09:48:00 +0100,unfulfilled,GBP,2400.00,2026-04-03 09:48:00 +0100,1,Vessel VIII,2400.00,V8,Sarah Mbeki,Sarah Mbeki,United Kingdom,vip
#AA10508,pieter.janssen@example.com,paid,2026-04-04 12:02:00 +0100,unfulfilled,EUR,2400.00,2026-04-04 12:02:00 +0100,1,Vessel VIII,2400.00,V8,Pieter Janssen,Pieter Janssen,Spain,repeat-collector
`;

export const BLUE_INTERVAL_CSV = `${HEADER}
#AA10301,eva.novak@example.com,paid,2026-01-15 09:00:00 +0000,fulfilled,GBP,320.00,2026-01-15 09:00:00 +0000,1,Blue Interval - Framed,320.00,BI-FR,Eva Novák,Eva Novák,United Kingdom,
#AA10302,george.baptiste@example.com,paid,2026-01-15 09:30:00 +0000,fulfilled,GBP,240.00,2026-01-15 09:30:00 +0000,1,Blue Interval - Unframed,240.00,BI-UF,George Baptiste,George Baptiste,United Kingdom,first-order
#AA10303,hana.suzuki@example.org,paid,2026-01-15 10:00:00 +0000,fulfilled,GBP,320.00,2026-01-15 10:00:00 +0000,1,Blue Interval - Framed,320.00,BI-FR,Hana Suzuki,Hana Suzuki,United Kingdom,"vip,framed-upgrade"
#AA10304,ivan.petrov@example.com,paid,2026-01-16 11:00:00 +0000,fulfilled,EUR,320.00,2026-01-16 11:00:00 +0000,1,Blue Interval - Framed,320.00,BI-FR,Ivan Petrov,Ivan Petrov,Poland,
#AA10305,julia.silva@example.com,paid,2026-01-16 12:00:00 +0000,fulfilled,EUR,240.00,2026-01-16 12:00:00 +0000,1,Blue Interval - Unframed,240.00,BI-UF,Júlia Silva,Júlia Silva,Netherlands,repeat-collector
#AA10306,kwame.asante@example.com,paid,2026-01-17 13:00:00 +0000,fulfilled,GBP,320.00,2026-01-17 13:00:00 +0000,1,Blue Interval - Framed,320.00,BI-FR,Kwame Asante,Kwame Asante,United Kingdom,
`;

export const NIGHT_GARDEN_CSV = `${HEADER}
#AA10601,olive.fitzgerald@example.com,paid,2026-08-20 09:12:00 +0100,unfulfilled,GBP,460.00,2026-08-20 09:12:00 +0100,1,Night Garden - Framed,460.00,NG-FR,Olive Fitzgerald,Olive Fitzgerald,United Kingdom,vip
#AA10602,ravi.sharma@example.com,paid,2026-08-20 09:45:00 +0100,unfulfilled,GBP,340.00,2026-08-20 09:45:00 +0100,1,Night Garden - Unframed,340.00,NG-UF,Ravi Sharma,Ravi Sharma,United Kingdom,repeat-collector
#AA10603,,paid,2026-08-20 10:15:00 +0100,unfulfilled,GBP,460.00,2026-08-20 10:15:00 +0100,1,Night Garden - Framed,460.00,NG-FR,Beatriz Almeida,Beatriz Almeida,United Kingdom,
#AA10604,charles.whitmore@example.net,paid,2026-08-20 11:00:00 +0100,unfulfilled,GBP,340.00,2026-08-20 11:00:00 +0100,1,Night Garden - Unframed,340.00,NG-UF,Charles Whitmore,Charles Whitmore,United Kingdom,first-order
#AA10605,dina.khoury@example.com,paid,2026-08-21 08:30:00 +0100,unfulfilled,EUR,460.00,2026-08-21 08:30:00 +0100,1,Night Garden - Framed,460.00,NG-FR,Dina Khoury,Dina Khoury,France,"vip,framed-upgrade"
#AA10605,dina.khoury@example.com,paid,2026-08-21 08:30:00 +0100,unfulfilled,EUR,460.00,2026-08-21 08:30:00 +0100,1,Night Garden - Framed,460.00,NG-FR,Dina Khoury,Dina Khoury,Germany,
#AA10606,emil.johansson@example.com,paid,2026-08-21 09:50:00 +0100,unfulfilled,EUR,340.00,2026-08-21 09:50:00 +0100,1,Night Garden - Unframed,340.00,NG-UF,Emil Johansson,Emil Johansson,Italy,repeat-collector
#AA10607,fatima.zahra@example.org,paid,2026-08-22 10:20:00 +0100,unfulfilled,GBP,460.00,2026-08-22 10:20:00 +0100,1,Night Garden - Framed,460.00,NG-FR,"Zahra, Fatima","Zahra, Fatima",United Kingdom,
`;

/**
 * Warehouse edition-allocation sheet for Falling Light, in the real sheet's
 * shape: junk validation rows above the header, a blank leading column,
 * framing columns empty for "Print Only" rows, an artist's proof ("AP")
 * edition, a multi-line-item order (#AA10418) with one framed and one
 * unframed row, two orders the warehouse hasn't allocated yet (#AA10448,
 * #AA10449) and one sheet row with no matching order (#AA10999).
 */
export const FALLING_LIGHT_ALLOCATION_CSV = `,,#REF!,0,0,TRUE,,,,Mismatches:,0
,,,0,0,TRUE,,,,,All multi-print orders have consistent edition numbers
,Order Number,Print Name,Fulfilment,Frame Finish,Glass,Mounting Type,Set_Size,Edition No.,,
,#AA10412,Falling Light,Framed,BLACK,Museum-grade acrylic,FLOAT,1,1,,
,#AA10413,Falling Light,Print Only,,,,1,2,,
,#AA10415,Falling Light,Print Only,,,,1,3,,
,#AA10416,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,4,,
,#AA10418,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,2,5,,
,#AA10418,Falling Light,Print Only,,,,2,5,,
,#AA10419,Falling Light,Framed,DARK BROWN,Museum-grade acrylic,WINDOW,1,6,,
,#AA10421,Falling Light,Print Only,,,,1,7,,
,#AA10422,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,8,,
,#AA10425,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,9,,
,#AA10427,Falling Light,Print Only,,,,1,AP,,
,#AA10428,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,10,,
,#AA10430,Falling Light,Print Only,,,,1,11,,
,#AA10431,Falling Light,Framed,BLACK,Museum-grade acrylic,FLOAT,1,12,,
,#AA10433,Falling Light,Framed,GREEN,UV-protective acrylic,FLOAT,1,13,,
,#AA10434,Falling Light,Print Only,,,,1,14,,
,#AA10436,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,15,,
,#AA10437,Falling Light,Print Only,,,,1,16,,
,#AA10439,Falling Light,Framed,WHITE,Museum-grade acrylic,FLOAT,1,17,,
,#AA10440,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,18,,
,#AA10442,Falling Light,Print Only,,,,1,19,,
,#AA10443,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,20,,
,#AA10445,Falling Light,Print Only,,,,1,21,,
,#AA10446,Falling Light,Framed,BURGUNDY,UV-protective acrylic,FLOAT,1,22,,
,#AA10999,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,23,,
`;

/**
 * Fake HubSpot contact directory (email → contact id). Deliberately missing:
 *   - tom.rivera@example.net   (Falling Light — flagged at import)
 *   - arthur.beaumont@example.net (Vessel VIII — flagged at import)
 *   - charles.whitmore@example.net (Night Garden — flagged at import)
 * The phase-2 implementation replaces this with the HubSpot contacts API.
 */
export const HUBSPOT_DIRECTORY: Record<string, string> = {
  'jane.whitfield@example.com': '30101',
  'marcus.oduya@example.com': '30102',
  'chidi.okafor@example.org': '30103',
  'sofia.lindqvist@example.com': '30104',
  'priya.raman@example.com': '30105',
  'daan.vermeer@example.com': '30106',
  'ines.moreau@example.com': '30107',
  'felix.brand@example.com': '30108',
  'amara.diallo@example.com': '30109',
  'noah.gallagher@example.org': '30110',
  'yuki.tanaka@example.com': '30111',
  'lars.petersen@example.net': '30112',
  'greta.hoffmann@example.com': '30113',
  'alice.ngata@example.com': '30114',
  'ben.osei@example.com': '30115',
  'clara.jimenez@example.org': '30116',
  'oliver.hart@example.com': '30117',
  'maja.kowalska@example.com': '30118',
  'ethan.brooks@example.com': '30119',
  'nadia.hassan@example.com': '30120',
  'leo.marchetti@example.org': '30121',
  'freya.dunbar@example.com': '30122',
  'william.acheampong@example.com': '30123',
  'rosa.delgado@example.com': '30124',
  'imogen.clarke@example.com': '30201',
  'henrik.dahl@example.com': '30202',
  'mei.wong@example.org': '30203',
  'lucia.ferrari@example.com': '30205',
  'jonas.weber@example.com': '30206',
  'sarah.mbeki@example.com': '30207',
  'pieter.janssen@example.com': '30208',
  'eva.novak@example.com': '30301',
  'george.baptiste@example.com': '30302',
  'hana.suzuki@example.org': '30303',
  'ivan.petrov@example.com': '30304',
  'julia.silva@example.com': '30305',
  'kwame.asante@example.com': '30306',
  'olive.fitzgerald@example.com': '30401',
  'ravi.sharma@example.com': '30402',
  'dina.khoury@example.com': '30403',
  'emil.johansson@example.com': '30404',
  'fatima.zahra@example.org': '30405',
};

export const USERS = [
  {
    id: 'user-tom',
    name: 'Tom Lloyd',
    email: 'tom.lloyd@avantarte.com',
    role: 'admin' as const,
  },
  {
    id: 'user-crm',
    name: 'Maya Delacroix',
    email: 'maya.delacroix@avantarte.com',
    role: 'admin' as const,
  },
  {
    id: 'user-pm',
    name: 'Priya Nair',
    email: 'priya.nair@avantarte.com',
    role: 'operator' as const,
  },
  {
    id: 'user-warehouse',
    name: 'Jakob Meijer',
    email: 'jakob.meijer@avantarte.com',
    role: 'operator' as const,
  },
];
