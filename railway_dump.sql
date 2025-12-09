--
-- PostgreSQL database dump
--

\restrict bDczhj2qO7uxhKFGxwP0Jblqz4QmMd98RGjMS9gotjmoqVQP4VlKRc7CAEVFebr

-- Dumped from database version 17.7 (Debian 17.7-3.pgdg13+1)
-- Dumped by pg_dump version 17.7 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Message" (
    id integer NOT NULL,
    author text NOT NULL,
    content text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Message_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Message_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Message_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Message_id_seq" OWNED BY public."Message".id;


--
-- Name: blicak_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blicak_registrations (
    id integer NOT NULL,
    name text NOT NULL,
    club text,
    lok text,
    birth_year integer,
    event_date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: blicak_registrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.blicak_registrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: blicak_registrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.blicak_registrations_id_seq OWNED BY public.blicak_registrations.id;


--
-- Name: competitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competitions (
    id text NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'chess-results'::text NOT NULL,
    url text NOT NULL,
    category text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    active boolean DEFAULT true NOT NULL,
    chesscz_url text
);


--
-- Name: games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.games (
    id integer NOT NULL,
    report_id integer NOT NULL,
    game_title text NOT NULL,
    chess_com_id text NOT NULL,
    team text NOT NULL,
    position_order integer NOT NULL,
    is_commented boolean DEFAULT false NOT NULL
);


--
-- Name: games_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.games_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: games_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.games_id_seq OWNED BY public.games.id;


--
-- Name: images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.images (
    id integer NOT NULL,
    filename text NOT NULL,
    original_name text,
    url text NOT NULL,
    alt_text text,
    uploaded_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: images_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.images_id_seq OWNED BY public.images.id;


--
-- Name: match_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_reports (
    id integer NOT NULL,
    news_id integer NOT NULL,
    match_date timestamp(3) without time zone NOT NULL,
    team_a_name text NOT NULL,
    team_b_name text NOT NULL,
    score_a integer,
    score_b integer,
    report_text text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: match_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.match_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: match_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.match_reports_id_seq OWNED BY public.match_reports.id;


--
-- Name: members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.members (
    id integer NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    elo integer,
    title text,
    birth_year integer,
    role text
);


--
-- Name: members_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.members_id_seq OWNED BY public.members.id;


--
-- Name: news; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news (
    id integer NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    category text NOT NULL,
    excerpt text NOT NULL,
    content text,
    thumbnail_url text,
    link_url text,
    games_json text,
    teams_json text,
    gallery_json text,
    published_date timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    author_id integer,
    intro_json text
);


--
-- Name: news_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.news_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: news_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.news_id_seq OWNED BY public.news.id;


--
-- Name: standings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standings (
    id integer NOT NULL,
    competition_id text NOT NULL,
    team text NOT NULL,
    rank integer NOT NULL,
    points double precision,
    wins integer,
    draws integer,
    losses integer,
    games integer,
    score double precision,
    schedule_json text,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: standings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.standings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: standings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.standings_id_seq OWNED BY public.standings.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    key text NOT NULL,
    value text NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    role text DEFAULT 'admin'::text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: Message id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message" ALTER COLUMN id SET DEFAULT nextval('public."Message_id_seq"'::regclass);


--
-- Name: blicak_registrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blicak_registrations ALTER COLUMN id SET DEFAULT nextval('public.blicak_registrations_id_seq'::regclass);


--
-- Name: games id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games ALTER COLUMN id SET DEFAULT nextval('public.games_id_seq'::regclass);


--
-- Name: images id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images ALTER COLUMN id SET DEFAULT nextval('public.images_id_seq'::regclass);


--
-- Name: match_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_reports ALTER COLUMN id SET DEFAULT nextval('public.match_reports_id_seq'::regclass);


--
-- Name: members id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members ALTER COLUMN id SET DEFAULT nextval('public.members_id_seq'::regclass);


--
-- Name: news id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news ALTER COLUMN id SET DEFAULT nextval('public.news_id_seq'::regclass);


--
-- Name: standings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standings ALTER COLUMN id SET DEFAULT nextval('public.standings_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: Message; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Message" (id, author, content, "createdAt") FROM stdin;
1	Tonda	testuju	2025-12-05 19:44:35.569
\.


--
-- Data for Name: blicak_registrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.blicak_registrations (id, name, club, lok, birth_year, event_date, created_at) FROM stdin;
1	Luděk Cyhelský	Tj Bižuterie Jablonec n.N.	48252	1954	2025-12-07 19:45:37.195	2025-12-07 19:45:37.196
2	Lukáš Sivák	TJ Bižuterie Jablonec 	43279	2001	2025-12-08 07:36:15.06	2025-12-08 07:36:15.061
3	Předseda Tonda	Bižu	18039	1987	2025-12-08 08:10:52.954	2025-12-08 08:10:52.955
4	Zdeněk Němec	TJ Bižuterie Jablonec nad Nisou	40166	1960	2025-12-08 08:52:36.888	2025-12-08 08:52:36.889
5	Filip Zadražil	TJ Bižuterie Jablonec	36539	1998	2025-12-08 18:45:25.483	2025-12-08 18:45:25.486
6	Miroslav Žídek		838	1965	2025-12-08 21:09:23.763	2025-12-08 21:09:23.765
\.


--
-- Data for Name: competitions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.competitions (id, name, type, url, category, created_at, active, chesscz_url) FROM stdin;
3255	1. liga mládeže A	chess-results	https://s3.chess-results.com/tnr1243811.aspx?lan=5&art=46&SNode=S0	youth	2025-12-06 16:34:28.191	t	\N
3363	Krajský přebor mládeže	chess-cz		youth	2025-12-06 16:34:28.486	f	https://www.chess.cz/soutez/3363/
ks-st-zaku	Krajská soutěž st. žáků	chess-results	https://s1.chess-results.com/tnr1310849.aspx?lan=5&art=0&SNode=S0	youth	2025-12-07 20:00:02.25	t	\N
ks-vychod	Krajská soutěž východ	chess-results	https://s2.chess-results.com/tnr1278502.aspx?lan=5&art=46&SNode=S0	teams	2025-12-06 16:34:28.634	t	\N
kp-liberec	Krajský přebor	chess-results	https://chess-results.com/tnr1276470.aspx?lan=5&art=46	teams	2025-12-06 16:34:28.782	t	\N
\.


--
-- Data for Name: games; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.games (id, report_id, game_title, chess_com_id, team, position_order, is_commented) FROM stdin;
\.


--
-- Data for Name: images; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.images (id, filename, original_name, url, alt_text, uploaded_at) FROM stdin;
1	1765059466163-209144401.webp	podzim2.jpg	/uploads/1765059466163-209144401.webp	\N	2025-12-06 22:17:47.506
2	1765059798180-702363435.webp	IMG_2740-HDR_jpeg.jpg	/uploads/1765059798180-702363435.webp	\N	2025-12-06 22:23:19.556
3	1765059834379-516326283.webp	podzim2.jpg	/uploads/1765059834379-516326283.webp	\N	2025-12-06 22:23:54.467
4	1765059942881-778915875.webp	IMG_2740-HDR_jpeg.jpg	/uploads/1765059942881-778915875.webp	\N	2025-12-06 22:25:43.055
5	1765059945903-209993894.webp	podzim2.jpg	/uploads/1765059945903-209993894.webp	\N	2025-12-06 22:25:45.994
6	1765059950122-999378330.webp	IMG_2740-HDR.jpg	/uploads/1765059950122-999378330.webp	\N	2025-12-06 22:25:50.302
7	1765059962876-972083592.webp	podzim2.jpg	/uploads/1765059962876-972083592.webp	\N	2025-12-06 22:26:02.981
8	1765145915621-669455960.webp	IMG_3254.jpeg	/uploads/1765145915621-669455960.webp	\N	2025-12-07 22:18:37.101
9	1765145936964-651835530.webp	IMG_3253.jpeg	/uploads/1765145936964-651835530.webp	\N	2025-12-07 22:18:57.279
10	1765145948320-690173476.webp	IMG_3250.png	/uploads/1765145948320-690173476.webp	\N	2025-12-07 22:19:08.74
11	1765205382676-618051833.webp	IMG_20251206_140115108_HDR.jpg	/uploads/1765205382676-618051833.webp	\N	2025-12-08 14:49:44.738
12	1765205386802-936544008.webp	IMG_20251206_140057342_HDR.jpg	/uploads/1765205386802-936544008.webp	\N	2025-12-08 14:49:47.052
13	1765206052017-385789761.webp	IMG_20251207_135351700_HDR.jpg	/uploads/1765206052017-385789761.webp	\N	2025-12-08 15:00:52.293
14	1765206156108-235813939.webp	IMG_20251206_165636180_HDR (1).jpg	/uploads/1765206156108-235813939.webp	\N	2025-12-08 15:02:36.411
15	1765206221913-208563020.webp	IMG_20251207_135351700_HDR.jpg	/uploads/1765206221913-208563020.webp	\N	2025-12-08 15:03:42.172
16	1765218976369-360504483.webp	1000005969.jpg	/uploads/1765218976369-360504483.webp	\N	2025-12-08 18:36:17.962
17	1765219083637-791495958.webp	1000005992.jpg	/uploads/1765219083637-791495958.webp	\N	2025-12-08 18:38:03.914
18	1765219085575-906848490.webp	IMG_3974.jpeg	/uploads/1765219085575-906848490.webp	\N	2025-12-08 18:38:05.874
19	1765219121411-542816121.webp	rotated_image.jpg	/uploads/1765219121411-542816121.webp	\N	2025-12-08 18:38:41.526
20	1765219126729-303536437.webp	rotated_image.jpg	/uploads/1765219126729-303536437.webp	\N	2025-12-08 18:38:46.824
21	1765219223593-253684703.webp	1000005968.jpg	/uploads/1765219223593-253684703.webp	\N	2025-12-08 18:40:23.886
22	1765222755438-132947618.webp	IMG_3258.png	/uploads/1765222755438-132947618.webp	\N	2025-12-08 19:39:16.604
23	1765222761272-508452046.webp	rotated_image.jpg	/uploads/1765222761272-508452046.webp	\N	2025-12-08 19:39:21.317
24	1765224083377-562963365.webp	IMG_3970.jpeg	/uploads/1765224083377-562963365.webp	\N	2025-12-08 20:01:24.936
25	1765224092896-965356756.webp	IMG_3970.jpeg	/uploads/1765224092896-965356756.webp	\N	2025-12-08 20:01:33.214
26	1765224096454-86010509.webp	rotated_image.jpg	/uploads/1765224096454-86010509.webp	\N	2025-12-08 20:01:36.556
27	1765224106491-585200126.webp	rotated_image.jpg	/uploads/1765224106491-585200126.webp	\N	2025-12-08 20:01:46.582
28	1765224125646-823109665.webp	rotated_image.jpg	/uploads/1765224125646-823109665.webp	\N	2025-12-08 20:02:05.723
29	1765224158915-300342208.webp	1000006039.jpg	/uploads/1765224158915-300342208.webp	\N	2025-12-08 20:02:39.085
30	1765224171376-231471139.webp	1000005969.jpg	/uploads/1765224171376-231471139.webp	\N	2025-12-08 20:02:51.619
31	1765224181051-975961155.webp	1000005969.jpg	/uploads/1765224181051-975961155.webp	\N	2025-12-08 20:03:01.369
32	1765224508845-48312164.webp	rotated_image.jpg	/uploads/1765224508845-48312164.webp	\N	2025-12-08 20:08:28.981
33	1765224548536-619824936.webp	1000005946.jpg	/uploads/1765224548536-619824936.webp	\N	2025-12-08 20:09:08.79
34	1765224659034-655114318.webp	1000005992.jpg	/uploads/1765224659034-655114318.webp	\N	2025-12-08 20:10:59.302
35	1765224664090-330128959.webp	rotated_image.jpg	/uploads/1765224664090-330128959.webp	\N	2025-12-08 20:11:04.197
36	1765225422715-528350169.webp	1000005992.jpg	/uploads/1765225422715-528350169.webp	\N	2025-12-08 20:23:43.012
37	1765225431918-515503086.webp	rotated_image.jpg	/uploads/1765225431918-515503086.webp	\N	2025-12-08 20:23:52.039
38	1765226392930-843197548.webp	podzim2.jpg	/uploads/1765226392930-843197548.webp	\N	2025-12-08 20:39:54.302
39	1765226399376-571780540.webp	rotated_image.jpg	/uploads/1765226399376-571780540.webp	\N	2025-12-08 20:39:59.465
40	1765226402061-689934368.webp	rotated_image.jpg	/uploads/1765226402061-689934368.webp	\N	2025-12-08 20:40:02.146
41	1765226545616-483517564.webp	podzim2.jpg	/uploads/1765226545616-483517564.webp	\N	2025-12-08 20:42:26.828
42	1765226716727-979742225.webp	1000005992.jpg	/uploads/1765226716727-979742225.webp	\N	2025-12-08 20:45:17.011
43	1765226721309-57387657.webp	rotated_image.jpg	/uploads/1765226721309-57387657.webp	\N	2025-12-08 20:45:21.425
44	1765226762405-870770713.webp	1000005947.jpg	/uploads/1765226762405-870770713.webp	\N	2025-12-08 20:46:02.671
45	1765226771129-6643751.webp	1000005949.jpg	/uploads/1765226771129-6643751.webp	\N	2025-12-08 20:46:11.409
46	1765244848860-69483407.webp	IMG_0553-scaled.jpg	/uploads/1765244848860-69483407.webp	\N	2025-12-09 01:47:29.228
\.


--
-- Data for Name: match_reports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.match_reports (id, news_id, match_date, team_a_name, team_b_name, score_a, score_b, report_text, created_at) FROM stdin;
\.


--
-- Data for Name: members; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.members (id, first_name, last_name, elo, title, birth_year, role) FROM stdin;
1	Antonin	Duda	2110	Fm	1	Předseda
\.


--
-- Data for Name: news; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.news (id, title, slug, category, excerpt, content, thumbnail_url, link_url, games_json, teams_json, gallery_json, published_date, created_at, updated_at, is_published, author_id, intro_json) FROM stdin;
10	Velká cena Libereckého kraje	velka-cena-libereckeho-kraje	Mládež	Aleš Červeň a Roman Tsantsala zvítězili ve svých kategoriích na turnaji v ZŠ Liberecká.	<p style="margin-bottom: 1rem; font-style: italic;">Jablonec nad Nisou – ZŠ Liberecká, sobota 27. září 2025</p>\n<p style="margin-bottom: 1rem;">Osm desítek nadějných šachistů se o víkendu utkalo v prvním dílu seriálu Velké ceny Libereckého kraje v rapid šachu mládeže. Hrálo se ve čtyřech kategoriích tempem 15 minut + 5 sekund za tah, systémem 7, resp. 9 kol.</p>\n<p style="margin-bottom: 1rem;">Turnaj do 10 let ovládl Ondřej Nožička (ŠK ZIKUDA Turnov), kategorii do 14 let jeho oddílový kolega Michal Král a do 18 let zvítězil turnovský Ondřej Svoboda. Elitní otevřený turnaj bez rozdílu věku vyhrál Jonáš Zeman (TJ Desko Liberec).</p>\n<p style="margin-bottom: 1.5rem;">Dařilo se i domácím. Z hráčů TJ Bižuterie Jablonec n. N. nastoupilo přes dvacet účastníků; <strong>Aleš Červeň zvítězil ve věkové kategorii do 16 let</strong> a <strong>Roman Tsantsala v kategorii do 8 let</strong>. Romanovi mohla pomoci i „domácí půda", je totiž žákem ZŠ Liberecká.</p>\n\n<h3 style="color: var(--primary-color); margin: 2rem 0 1rem;">Výsledky podle kategorií</h3>\n\n<h4 style="margin-bottom: 0.5rem;">ELITE (každý s každým, 9 kol)</h4>\n<ol style="padding-left: 1.5rem; margin-bottom: 1.5rem; color: var(--text-muted);">\n    <li>Jonáš Zeman (TJ Desko Liberec) – 6,5 b.</li>\n    <li>Ivan Bureha (TJ Lokomotiva Liberec) – 6 b.</li>\n    <li>Vojta Holeš (TJ Desko Liberec) – 5,5 b.</li>\n</ol>\n\n<h4 style="margin-bottom: 0.5rem;">U16, U18 (každý s každým, 7 kol)</h4>\n<ol style="padding-left: 1.5rem; margin-bottom: 1.5rem; color: var(--text-muted);">\n    <li>Ondřej Svoboda (ŠK ZIKUDA Turnov) – 6,5 b.</li>\n    <li>Valentina Mohylová (TJ Lokomotiva Liberec) – 5,5 b.</li>\n    <li><strong>Aleš Červeň (TJ Bižuterie Jablonec n. N.) – 4,5 b.</strong></li>\n</ol>\n\n<h4 style="margin-bottom: 0.5rem;">U12, U14 (švýcarský systém, 7 kol)</h4>\n<ol style="padding-left: 1.5rem; margin-bottom: 1.5rem; color: var(--text-muted);">\n    <li>Michal Král (ŠK ZIKUDA Turnov) – 6,5 b.</li>\n    <li>Jonáš Roubíček (ŠK ZIKUDA Turnov) – 6 b.</li>\n    <li>Vojtěch Horáček (ŠK ZIKUDA Turnov) – 5,5 b.</li>\n</ol>\n\n<h4 style="margin-bottom: 0.5rem;">U08, U10 (švýcarský systém, 7 kol)</h4>\n<ol style="padding-left: 1.5rem; margin-bottom: 1.5rem; color: var(--text-muted);">\n    <li>Ondřej Nožička (ŠK ZIKUDA Turnov) – 7 b.</li>\n    <li>David Krejčí (ŠK ZIKUDA Turnov) – 6 b.</li>\n    <li><strong>Roman Tsantsala (TJ Bižuterie Jablonec n. N.) – 5,5 b.</strong></li>\n</ol>	images/youth_tournament.png	youth.html	\N	\N	\N	2025-09-27 00:00:00	2025-12-04 20:15:17.096	2025-12-05 20:44:17.96	t	1	\N
12	1. kolo - Bižuterie A vs Bižuterie B	1-kolo-bi-uterie-a-vs-bi-uterie-b	Soutěže družstev	Derby Bižuterie mělo tentokrát jasného favorita a Áčko to na úvod soutěže potvrdilo, i přesto že se partie často otáčeli vícekrát než jedou. 	<div class="puzzle-section">\n    <p style="font-size: 1.1rem; margin-bottom: 1rem;">\n        🧩 <strong>Pozice z partie Šalanda – Žídek</strong><br>\n        Bílý je na tahu a mohl rozhodnout partii ve svůj prospěch.<br>\n        Najdete vítězný tah? ♟️\n    </p>\n    <img src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhU8z8yMLXbAZ_6tpOqOElzKBW5KyhvFynQP1n8BdLvv2yqLWF0FW4UwsFMQeKyEhHaaPUX9RsmGJtDFQ9uaeL34O69dy99inypBZncg_jgILJ_BHSn_cI902hOsoEQKyTwOfLwwUgKDskwjZ4ySuRS9rkSE5fnTEn0w9U9m92x-yjWvalAoWcebFNVCCPz/s320/board-2.jpeg" alt="Pozice z partie Šalanda – Žídek" style="max-width: 320px; display: block; margin: 1rem auto;">\n</div>\n<div class="card" style="margin: 2rem 0;">\n    <div class="card-content">\n        <p style="font-size: 1.1rem; line-height: 1.8;">\n            Derby Bižuterie mělo tentokrát jasného favorita a Áčko to na úvod soutěže potvrdilo, i přesto že se partie často otáčeli vícekrát než jedou. <strong>Bižu A – Bižu B 6,5 : 1,5</strong> (9. 11. 2025).\n        </p>\n        <p style="font-size: 1.1rem; line-height: 1.8; margin-top: 1rem;">\n            Body vítězů obstarali Antonín Duda, Vladimír Vltavský, Lukáš Sivák, Miroslav Žídek, Miloš Fila a František Mlot, půl bodu přidal Jonáš Chvátal. Za béčko se radovala jen Ema Brehmová na 8. šachovnici.\n        </p>\n    </div>\n</div>	https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhU8z8yMLXbAZ_6tpOqOElzKBW5KyhvFynQP1n8BdLvv2yqLWF0FW4UwsFMQeKyEhHaaPUX9RsmGJtDFQ9uaeL34O69dy99inypBZncg_jgILJ_BHSn_cI902hOsoEQKyTwOfLwwUgKDskwjZ4ySuRS9rkSE5fnTEn0w9U9m92x-yjWvalAoWcebFNVCCPz/s320/board-2.jpeg	report_1kolo.html	[{"title":"1. Duda - Vacek","gameId":"14096201","team":"A tým"},{"title":"2. Tsantsala - Vltavský","gameId":"14102243","team":"A tým"},{"title":"3. Chvátal - Zadražil","gameId":"14096241","team":"A tým"},{"title":"4. Šalanda - Žídek","gameId":"14102245","team":"A tým"},{"title":"5. Sivák - Tsantsala","gameId":"14102271","team":"A tým"},{"title":"6. Koten - Fila","gameId":"14096321","team":"A tým"},{"title":"7. Mlot - Cyhelský","gameId":"14096309","team":"A tým"},{"title":"8. Brehmová - Vacková","gameId":"14096329","team":"A tým"}]	{"all":["A tým"],"selected":["A tým"]}	[]	2025-11-09 00:00:00	2025-12-05 09:08:18.855	2025-12-05 19:27:22.841	t	1	\N
3	Mistrovství Čech v Harrachově	mistrovstvi-cech-harrachov	Mládež	Úspěchy našich mladých šachistů na Mistrovství Čech.	<p style="margin-bottom: 1.5rem;">V prosinci 2025 se naši mládežníci zúčastnili Mistrovství Čech v rapid šachu v Harrachově. Turnaj se konal v krásném prostředí Krkonoš a přilákal desítky nadějných šachistů z celé republiky.</p>\n<p style="margin-bottom: 1.5rem;">Naši hráči předvedli vynikající výkony a reprezentovali oddíl se ctí. Atmosféra turnaje byla skvělá a všichni si odvezli cenné zkušenosti.</p>	https://blogger.googleusercontent.com/img/a/AVvXsEjJ8B0e9gRNW0Sp2GwMUI3AYxaBzSZE5d9lvjNq1CMHVmwN1aHlSQHcOTL5z-9wIBOoaRwBZimEtF3IlGh61mhFbUUkRMoESgB1eq5hSig9kmrmelvThdTWk1lN-mjmZABjlnu_ljZiDeRzXDD1JRgYDRScKjukllHF4BenjKldVLe6qolzZNWxUj2yWFfh	youth.html	\N	\N	["https://blogger.googleusercontent.com/img/a/AVvXsEjJ8B0e9gRNW0Sp2GwMUI3AYxaBzSZE5d9lvjNq1CMHVmwN1aHlSQHcOTL5z-9wIBOoaRwBZimEtF3IlGh61mhFbUUkRMoESgB1eq5hSig9kmrmelvThdTWk1lN-mjmZABjlnu_ljZiDeRzXDD1JRgYDRScKjukllHF4BenjKldVLe6qolzZNWxUj2yWFfh","https://blogger.googleusercontent.com/img/a/AVvXsEj6hZaHt57il2zLx53Ghi1HdethKcZMvEPeWsiCAv705hspIViBpNwr42h_9XMU2M_qqwPbm7k8U0sk0P7Z3FLUNZr4nvy11LsTkyYgBUSER2M7PVJJQUPpKs1Xt7lH1w4PldaAOesTwYuhfS604wdzu-fElXhoXjB1shW6CcK6I-FdzzeEQawLsw-tZiYN","https://blogger.googleusercontent.com/img/a/AVvXsEilHUjvMIQ6ncFfGSurDge1M8A4qceK2KvE9mA24en0J1NsOk95vL7f7CUG4m5GGh_NVhzq16ut9-qq6_hg1BUePZs1Cp0Dxbe7jhd6EMCxp1drqqD_1YylDacp-hqRpQPb_CRyT8-NVB2ooovrtc1nK_uqgG2P2qbQqVgdVQvp_oTSIMlprlOih5-SyHno","https://blogger.googleusercontent.com/img/a/AVvXsEi5N9PChSstZeutWot9LwVxNtAs5eSdbukW9_wEkX3D-vBAe-A0dYluneLmbCZwRSNIr3KsfQDP2C86n3nt2DmOTlvEMo3fUfMPQ1rq9-Pby9gJRT1Deq-7PySsSGye8zjxgyebWfWZMQZRTTTJCX2OzDB6jz4lhyBhFXiUTyCru3bjISaun5DdQ-5W_x4L"]	2025-10-25 00:00:00	2025-12-04 20:10:38.144	2025-12-05 20:44:17.658	t	1	\N
50	3. kolo KP dospělých aneb Béčko v Tanvaldu	3-kolo-kp-dosp-l-ch-aneb-b-ko-v-tanvaldu	Soutěže družstev	Report z utkání bižuteráckého béčka dospělých v Tanvaldu.	Béčko v Tanvaldu v třetím kole dospělého krajského přeboru bylo tradičně na všech šachovnicích slabší. Někdy s tím něco uděláme, někdy ne. Tentokrát se elová síla soupeřů projevila i na výsledku.<div><br></div><div>Body uhráli jen hosté <span class="highlight-name">pan Vacek</span>  a <span class="highlight-name">Vojta Holeš</span>, oba černými remizovali. Naše bílé figury na sudých šachovnicích ještě po dvou hodinách hry vypadaly nadějně. <span class="highlight-name">Kosťa Tsantsala</span>  stál s Ondrou Pražákem chvílemi +3. Já s p. Vašákem držel vyrovnanou pozici podobně jako <span class="highlight-name">Standa Mašek </span> se svým extrenérem Jouklem. <span class="highlight-name">Aleš Červeň </span> měl proti panu Hnátovi dokonce kvalitu víc. Přesto jsme postupně všichni prohráli. A tedy <span class="highlight-score">1:7</span>.</div><div><br></div><div>Zápas byl ovšem pěkný a atmosféra příjemná. Vzpomeňme Zdeňkovo entré do tanvaldské klubovny: "Myslel jsem, že hrajeme s Tanvaldem a tady je to samý Pražák."</div>	https://www.sachyjablonec.cz/uploads/1765225431918-515503086.webp?t=1765225431478#crop=12%	\N	[]	\N	["https://www.sachyjablonec.cz/uploads/1765226721309-57387657.webp?t=1765226720860"]	2025-12-08 00:00:00	2025-12-08 15:01:02.434	2025-12-08 20:55:38.008	t	2	\N
52	A	a	Soutěže družstev	C	B	\N	\N	[]	\N	[]	2025-12-08 00:00:00	2025-12-08 20:17:07.741	2025-12-08 20:17:07.741	f	1	\N
11	2. kolo Krajský přebor - Report	2-kolo-krajsk-p-ebor-report	Soutěže družstev	Report z utkání A a B týmu v 2. kole Krajského přeboru.	<p style="margin-bottom: 2rem;">Report z utkání A a B týmu v 2. kole Krajského přeboru. A tým remizoval 4:4 s Tanvaldem, B tým prohrál 3:5 s Českou Lípou</p>\n                \n<!-- Report A Tým -->\n<div class="collapsible-wrapper">\n    <div class="collapsible-header" onclick="toggleSection('reportA', 'iconA')">\n        <h3><i class="fa-solid fa-chess-king"></i> Report z utkání A týmu</h3>\n        <i id="iconA" class="fa-solid fa-chevron-down"></i>\n    </div>\n    <div id="reportA" class="collapsible-content hidden">\n        <img src="https://i.ibb.co/twbZWXzm/IMG-3192.jpg" alt="Zápas s Tanvaldem" style="max-width: 50%; border-radius: 8px; cursor: pointer; display: block; margin: 1rem auto;">\n        <p>Áčko nastoupilo proti tradičnímu soupeři z Tanvaldu a oba týmy dorazily v poměrně silných sestavách.</p>\n        <p>Na 4. šachovnici sehráli <span class="highlight-name">Tomáš Duran</span> s <span class="highlight-name">Vláďou Jedličkou</span> velmi plochou variantu Philidorovy obrany. Ani jeden nebyl příliš bojovně naladěn, takže zapisujeme první remízu: <span class="highlight-score">0,5 : 0,5</span>.</p>\n        <p>Na 3. šachovnici skončil rychlou remízou i duel <span class="highlight-name">Vládi Vltavského</span> s <span class="highlight-name">Ondrou Pražákem</span>, který se odehrál v symetrické pěšcové struktuře. Stav tedy <span class="highlight-score">1 : 1</span>.</p>\n        <p><span class="highlight-name">Lukáš Sivák</span> na 5. šachovnici získal s <span class="highlight-name">Zdeňkem Jouklem</span> slibnou pozici s možností útoku, ale pokračoval nepřesně. Nakonec mohl být rád, že mu koryfej jizerského šachu nabídl remízu – <span class="highlight-score">1,5 : 1,5</span>.</p>\n        <p>Na první desce sehrál <span class="highlight-name">Marek Sýkora</span> riskantní partii. Sezobl pěšce, za kterého měl černý (<span class="highlight-name">Tomáš Fraňa</span>) kompenzaci, ale soupeř poté příliš ambiciózně a neuváženě „daroval" celou figuru – střelce na a6. Marek materiál beze strachu přijal, přešel do protiútoku a partii rychle a pěkně vyhrál. Stav <span class="highlight-score">2,5 : 1,5</span>.</p>\n        <p>Na 2. šachovnici jsem nastoupil proti někdejšímu elitnímu mládežníkovi <span class="highlight-name">Marku Přiborskému</span>. Hrál se výměnný Caro–Kann a bílý pokračoval urychleným f4. To mi poskytlo poměrně snadnou, i když objektivně vyrovnanou pozici. Získal jsem velký časový náskok a dostal nabídku remízy. Chvíli jsem váhal, ale pozice na 6. a 7. šachovnici vypadaly pro nás nadějně. Po zvážení situace jsem remízu přijal, protože nás výrazně přiblížila k zápasové výhře – <span class="highlight-score">3 : 2</span>.</p>\n        <p>Na 8. šachovnici měl <span class="highlight-name">Miloš Fila</span> proti <span class="highlight-name">Toljovi Falesovi</span> šanci na protihru, pokud by sebral pěšce na a2. Zalekl se však a soupeř ho postupně „umačkal". Stav <span class="highlight-score">3 : 3</span>.</p>\n        <p><span class="highlight-name">Libor Titěra</span> sehrál černými v Blumenfeldově gambitu ukázkovou partii proti <span class="highlight-name">Romanu Žambochovi</span> a zcela ho přehrál. Kvůli nedostatku času ale promarnil několik cest k výhře a po 40. tahu partie skončila vyrovnaně – <span class="highlight-score">3,5 : 3,5</span>.</p>\n        <p>Zápas se tedy snažil zlomit v náš prospěch <span class="highlight-name">Mirek Žídek</span>. Měl partii s <span class="highlight-name">Břéťou Tejským</span> dobře rozehranou, ale v časové tísni se začaly kupit chyby na obou stranách. Přesto si udržel nějakou výhodu, jenže materiál už byl velmi zredukovaný. Mirek bojoval dlouho, ale vítězství z toho bohužel nevytěžil.</p>\n        <p>Zápas s Tanvaldem tak končí <span class="highlight-score">4 : 4</span>.</p>\n    </div>\n</div>\n\n<!-- Report B Tým -->\n<div class="collapsible-wrapper">\n    <div class="collapsible-header" onclick="toggleSection('reportB', 'iconB')">\n        <h3><i class="fa-solid fa-chess-pawn"></i> Report z utkání B týmu</h3>\n        <i id="iconB" class="fa-solid fa-chevron-down"></i>\n    </div>\n    <div id="reportB" class="collapsible-content hidden">\n        <img src="https://i.ibb.co/wZ1wgcRT/IMG-3196.jpg" alt="Zápas s Deskem Liberec" style="max-width: 50%; border-radius: 8px; cursor: pointer; display: block; margin: 1rem auto;">\n        <p>Béčko nastoupilo k zápasu s favorizovaným Deskem Liberec v téměř nejsilnější možné sestavě, ale ani to bohužel na body nestačilo. Utkání našeho béčka s béčkem českolipským skončilo porážkou <span class="highlight-score">3:5</span>. Někteří naši hráči si uhráli pěkné výsledky, ale jako tým jsme tentokrát k bodům měli daleko.</p>\n        <p>Na osmé šachovnici jsme měli jako na jediné elově navrch, ale <span class="highlight-name">Alešovi Červeňovi</span> se partie nepovedla, a tak jsme brzy prohrávali <span class="highlight-score">0:1</span>. Na to ještě dokázal odpovědět <span class="highlight-name">Zdeněk Němec</span>, když na sedmičce srovnal na <span class="highlight-score">1:1</span>, jenže v dalších pěti minutách už to bylo <span class="highlight-score">1:3</span>, když se <span class="highlight-name">Vojta Holeš</span> zamotal bílými ve francouzské s <span class="highlight-name">p. Jínovou</span> a <span class="highlight-name">Luděk Cyhelský</span> podcenil nebezpečí subjektivně vyrovnané pozice.</p>\n        <p>Ve čtvrté hodině hry přidali cenné remízy po kvalitních výkonech s <span class="highlight-name">p. Völflem</span>, respektive <span class="highlight-name">p. Halamou</span> <span class="highlight-name">Kosťa Tsantsala</span> s <span class="highlight-name">Kristiánem Kotenem</span> <span class="highlight-score">2:4</span>.</p>\n        <p>Teprve pak jsem dohrál na čtyřce já, i když zdechlý proti <span class="highlight-name">Frantsevovi</span> jsem byl už dlouho. Paradoxně jsem se vzdal v momentě, kdy jsem krásným Vxg2 s patovým motivem mohl remízu přeci jen vybojovat. <span class="highlight-score">2:5</span>.</p>\n        <p>Poctivý výkon na jedničce na závěr předvedl <span class="highlight-name">pan Vacek</span>, který po pěti hodinách korigoval na konečných <span class="highlight-score">3:5</span>.</p>\n    </div>\n</div>	https://i.ibb.co/twbZWXzm/IMG-3192.jpg	report_2kolo.html	[{"title":"1. Sýkora - Fraňa","gameId":"14190545","team":"A tým"},{"title":"2. Přiborský - Duda","gameId":"14190547","team":"A tým","commented":true},{"title":"3. Vltavský - Pražák","gameId":"14190553","team":"A tým"},{"title":"4. Jedlička - Durán","gameId":"14190555","team":"A tým"},{"title":"5. Sivák - Joukl","gameId":"14190557","team":"A tým"},{"title":"6. Žamboch - Titěra","gameId":"14190559","team":"A tým"},{"title":"7. Žídek - Tejnský","gameId":"14190561","team":"A tým"},{"title":"8. Faleš - Fila","gameId":"14190565","team":"A tým"},{"title":"1. Vacek - Jina","gameId":"14190569","team":"B tým"},{"title":"2. Völfl - Tsantsala","gameId":"14190571","team":"B tým","commented":false},{"title":"3. Holeč - Jínová","gameId":"14190575","team":"B tým"},{"title":"4. Frantsev - Zadražil","gameId":"14190577","team":"B tým"},{"title":"5. Koten - Halama","gameId":"14190579","team":"B tým"},{"title":"6. Sichrovský - Cyhelský","gameId":"14190581","team":"B tým"},{"title":"7. Němec - Drvota","gameId":"14190585","team":"B tým"},{"title":"8. Jína - Červen","gameId":"14190589","team":"B tým"}]	{"all":["A tým","B tým"],"selected":["A tým","B tým"]}	["https://i.ibb.co/twbZWXzm/IMG-3192.jpg","https://i.ibb.co/wZ1wgcRT/IMG-3196.jpg"]	2025-12-03 00:00:00	2025-12-05 09:08:18.548	2025-12-08 10:29:12.297	t	1	\N
49	Druhý sraz první ligy	druh-sraz-prvn-ligy	Mládež	O mikulášském víkendu se šest našich nejlepších mládežníků vydalo do České Lípy odehrát dvě důležitá prvoligová utkání.	<div>V prvním zápase s Turnovem se nám nedařilo, i když zpočátku to vypadalo hratelně. <span class="highlight-name">Ema Brehmová</span>  stála na prohru už ze zahájení, statečně bojovala přes tři hodiny, ale s materiálem víc to nešlo. <span class="highlight-name">Ráďa Šalanda</span>  nezvykle uklouzl takticky. Ale <span class="highlight-name">Kristián Koten</span>  vyhrál, a tak na pomyslné tabuli svítil stav <span class="highlight-score">1:<b>2</b></span><b></b>.</div><div><br></div><div>Jenže proti známé útočníku <span class="highlight-name">Kosťovi Tsantsalovi</span><b>&nbsp; t</b>entokrát naopak turnovský Sochor divoce obětoval materiál a naše jednička to neustála. V suché vyrovnané koncovce pak chyboval i <span class="highlight-name">​Aleš Červeň</span>&nbsp;a zápas byl ztracený – <span class="highlight-score">1:4</span>.</div><div><br></div><div>Výbornou partii se silnou Tománkovou odehrál&nbsp;<span class="highlight-name">​Miki Koten</span>&nbsp; V partii hrál mimořádně zodpovědně, což ho ovšem stálo množství času. V oboustranné časové tísni pak pozici zkazil chvíli předtím, než by sofijská pravidla umožnila nabídku remízy, kterou by soupeřka patrně akceptovala. A tak jsme prohráli <span class="highlight-score">​1:5</span>.</div><div><br></div><div>Odpoledne jsme hráli s Českou Lípou a vypadalo to výrazně nadějněji. I tentokrát byla první rozhodnuta partie Emy, soupeře za jeho přispění sfoukla jako svíčku a my vedli 1:0. Kristián Koten musel v nadějné pozici zopakovat tahy a pouze remizoval. <span class="highlight-name">Miki Koten</span> partii zkazil a brzy prohrál. <span class="highlight-score">1,5:1,5</span>.</div><div><br></div><div>Mimořádně se povedla partie <span class="highlight-name">Ráďovi Šalandovi</span>, který soupeře ztrestal v útočném stylu. Zdálo by se, že z průběžného stavu <span class="highlight-score">2,5:1,5</span> body musí padnout.</div><div><br></div><div>Nepadly. Aleš Červeň celou partii platonicky útočil, ale na g–sloupci neprorazil a figury zamotal. <span class="highlight-score">2,5:2,5</span>. A protože českolipský Frantsev se zdárně ubránil Kosťově agresi a dokonce dokázal přeskočit do protiútoku, sklidili jsme hořkou porážku <span class="highlight-score">​2,5:3,5</span>&nbsp;.</div><div><br></div><div>V soutěži tak dělíme 9. až 11. místo a zbylé dva srazy budou hodně perné. Z hlediska přístupu však všichni zúčastnění zaslouží pochvalu!</div>	https://www.sachyjablonec.cz/uploads/1765224548536-619824936.webp#crop=50%	\N	[]	\N	["https://www.sachyjablonec.cz/uploads/1765226762405-870770713.webp","https://www.sachyjablonec.cz/uploads/1765226771129-6643751.webp"]	2025-12-08 00:00:00	2025-12-08 14:53:55.348	2025-12-08 20:56:22.759	t	2	\N
\.


--
-- Data for Name: standings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.standings (id, competition_id, team, rank, points, wins, draws, losses, games, score, schedule_json, updated_at) FROM stdin;
3795	3255	TJ Kobylisy	1	18	6	0	0	6	30	[]	2025-12-09 14:02:46.607
3796	3255	VHS PROJEKT Kralupy	2	16	5	1	0	6	26.5	[]	2025-12-09 14:02:46.904
3797	3255	Desko Liberec	3	16	5	1	0	6	26	[]	2025-12-09 14:02:47.052
3798	3255	ŠK JOLY Lysá n.L. B	4	14	4	2	0	6	25.5	[]	2025-12-09 14:02:47.203
3799	3255	ŠK Slavoj Litoměřice	5	7	2	1	3	6	15	[]	2025-12-09 14:02:47.351
3800	3255	ŠŠPM Lipky HK	6	7	2	1	3	6	12	[]	2025-12-09 14:02:47.5
3801	3255	ŠK ZIKUDA Turnov	7	6	1	3	2	6	15.5	[]	2025-12-09 14:02:47.648
3802	3255	ŠK Lípa	8	5	1	2	3	6	15	[]	2025-12-09 14:02:47.796
3803	3255	TJ Bohemians Praha B	9	4	1	1	4	6	15.5	[]	2025-12-09 14:02:47.945
3804	3255	TJ Bižuterie Jablonec	10	4	1	1	4	6	14	[{"round":"1","date":"2025/10/04","opponent":"Desko Liberec","result":"3 : 3 ","isHome":false},{"round":"2","date":"2025/10/04","opponent":"ŠK Teplice","result":"5 : 1 ","isHome":true},{"round":"3","date":"2025/10/05","opponent":"ŠK Slavoj Litoměřice","result":"4 : 2 ","isHome":false},{"round":"4","date":"2025/10/05","opponent":"TJ Kobylisy","result":"5½ : ½ ","isHome":false},{"round":"5","date":"2025/12/06","opponent":"ŠK ZIKUDA Turnov","result":"1 : 5 ","isHome":true},{"round":"6","date":"2025/12/06","opponent":"ŠK Česká Lípa","result":"3½ : 2½ ","isHome":false},{"round":"7","date":"2026/01/24","opponent":"VHS PROJEKT Kralupy","result":" :  ","isHome":true},{"round":"8","date":"2026/01/24","opponent":"ŠK JOLY Lysá n.L. B","result":" :  ","isHome":false},{"round":"9","date":"2026/04/25","opponent":"TJ Bohemians Praha B","result":" :  ","isHome":true},{"round":"10","date":"2026/04/25","opponent":"ŠK Lípa","result":" :  ","isHome":false},{"round":"11","date":"2026/04/26","opponent":"ŠŠPM Lipky HK","result":" :  ","isHome":true}]	2025-12-09 14:02:48.094
3805	3255	ŠK Česká Lípa	11	4	1	1	4	6	12	[]	2025-12-09 14:02:48.242
3806	3255	ŠK Teplice	12	0	0	0	6	6	9	[]	2025-12-09 14:02:48.39
3807	ks-st-zaku	TJ Desko Liberec C Žirafy	1	13	4	1	0	5	15	[]	2025-12-09 14:02:48.984
3808	ks-st-zaku	TJ Bižuterie Jablonec n.N. JR1	2	12	4	0	1	5	14.5	[{"round":"1","date":"2025/12/06","opponent":"TJ Desko Liberec C Žirafy","result":"3 : 1 ","isHome":false},{"round":"2","date":"2025/12/06","opponent":"TJ Desko Liberec G Psi","result":"4 : 0 ","isHome":true},{"round":"3","date":"2025/12/06","opponent":"ŠK ZIKUDA Turnov G Petrova banda","result":"0 : 4 ","isHome":false},{"round":"4","date":"2025/12/06","opponent":"TJ Desko Liberec F Lišky","result":"3 : 1 ","isHome":true},{"round":"5","date":"2025/12/06","opponent":"ŠK ZIKUDA Turnov D","result":"1½ : 2½ ","isHome":false}]	2025-12-09 14:02:49.133
3809	ks-st-zaku	ŠK ZIKUDA Turnov F Zdislava	3	9	3	0	2	5	12	[]	2025-12-09 14:02:49.281
3810	ks-st-zaku	TJ Desko Liberec F Lišky	4	9	3	0	2	5	11.5	[]	2025-12-09 14:02:49.43
3811	ks-st-zaku	ŠK ZIKUDA Turnov D	5	8	2	2	1	5	12	[]	2025-12-09 14:02:49.579
3812	ks-st-zaku	TJ Bižuterie Jablonec n.N. L	6	8	2	2	1	5	11.5	[{"round":"1","date":"2025/12/06","opponent":"TJ Bižuterie Jablonec n.N. JR2","result":"2 : 2 ","isHome":true},{"round":"1","date":"2025/12/06","opponent":"TJ Desko Liberec C Žirafy","result":"3 : 1 ","isHome":false},{"round":"2","date":"2025/12/06","opponent":"TJ Desko Liberec D Medvědi","result":"1 : 3 ","isHome":false},{"round":"2","date":"2025/12/06","opponent":"TJ Bižuterie Jablonec n.N. JR2","result":"4 : 0 ","isHome":false},{"round":"2","date":"2025/12/06","opponent":"TJ Bižuterie Jablonec n.N. JR1","result":"4 : 0 ","isHome":false},{"round":"3","date":"2025/12/06","opponent":"ŠK ZIKUDA Turnov F Zdislava","result":"3 : 1 ","isHome":true},{"round":"3","date":"2025/12/06","opponent":"ŠK ZIKUDA Turnov E Skála","result":"2 : 2 ","isHome":false},{"round":"3","date":"2025/12/06","opponent":"ŠK ZIKUDA Turnov G Petrova banda","result":"0 : 4 ","isHome":false},{"round":"4","date":"2025/12/06","opponent":"ŠK ZIKUDA Turnov D","result":"2 : 2 ","isHome":false},{"round":"4","date":"2025/12/06","opponent":"TJ Bižuterie Jablonec n.N. JR1","result":"3 : 1 ","isHome":false},{"round":"4","date":"2025/12/06","opponent":"TJ Bižuterie Jablonec n.N. JR2","result":"1 : 3 ","isHome":false},{"round":"5","date":"2025/12/06","opponent":"TJ Desko Liberec C Žirafy","result":"2½ : 1½ ","isHome":false},{"round":"5","date":"2025/12/06","opponent":"ŠK ZIKUDA Turnov D","result":"1½ : 2½ ","isHome":false},{"round":"5","date":"2025/12/06","opponent":"TJ Desko Liberec F Lišky","result":"3 : 1 ","isHome":false}]	2025-12-09 14:02:49.728
3813	ks-st-zaku	ŠK ZIKUDA Turnov G Petrova banda	8	7	2	1	2	5	10	[]	2025-12-09 14:02:49.876
3814	ks-st-zaku	Jizerský drak	9	7	1	2	1	4	9	[]	2025-12-09 14:02:50.025
3815	ks-st-zaku	TJ Desko Liberec D Medvědi	10	6	1	1	2	4	10.5	[]	2025-12-09 14:02:50.173
3816	ks-st-zaku	TJ Desko Liberec E Koaly	11	6	2	0	3	5	8	[]	2025-12-09 14:02:50.322
3817	ks-st-zaku	TJ Bižuterie Jablonec n.N. JR2	12	5	1	2	2	5	10	[{"round":"1","date":"2025/12/06","opponent":"TJ Bižuterie Jablonec n.N. L","result":"2 : 2 ","isHome":false},{"round":"2","date":"2025/12/06","opponent":"Jizerský drak","result":"4 : 0 ","isHome":true},{"round":"3","date":"2025/12/06","opponent":"ŠK ZIKUDA Turnov E Skála","result":"2 : 2 ","isHome":false},{"round":"4","date":"2025/12/06","opponent":"ŠK ZIKUDA Turnov G Petrova banda","result":"1 : 3 ","isHome":true},{"round":"5","date":"2025/12/06","opponent":"TJ Desko Liberec F Lišky","result":"3 : 1 ","isHome":false}]	2025-12-09 14:02:50.47
3818	ks-st-zaku	TJ Desko Liberec H Papoušci	13	3	0	1	3	4	5.5	[]	2025-12-09 14:02:50.619
3819	ks-st-zaku	TJ Desko Liberec I Zebry	14	3	0	1	3	4	5	[]	2025-12-09 14:02:50.767
3820	ks-st-zaku	TJ Desko Liberec G Psi	15	3	0	1	3	4	4	[]	2025-12-09 14:02:50.915
3821	ks-vychod	ŠK ZIKUDA Turnov "F"	1	9	3	0	0	3	6	[]	2025-12-09 14:02:51.509
3822	ks-vychod	TJ Spartak Rokytnice n.Jizerou	2	8	2	0	1	3	4	[]	2025-12-09 14:02:51.658
3823	ks-vychod	TJ Bižuterie Jablonec n.Nisou "C"	3	8	1	1	1	3	3	[{"round":"1","date":"2025/11/02","opponent":"TJ Bižuterie Jablonec n.Nisou \\"D\\"","result":"3½ : 1½ ","isHome":true},{"round":"2","date":"2025/11/16","opponent":"ŠK ZIKUDA Turnov \\"F\\"","result":"3 : 2 ","isHome":false},{"round":"2","date":"2025/11/16","opponent":"TJ Bižuterie Jablonec n.Nisou \\"D\\"","result":" :  ","isHome":false},{"round":"3","date":"2025/11/30","opponent":"TJ Desko Liberec \\"C\\"","result":"2½ : 2½ ","isHome":true},{"round":"3","date":"2025/11/30","opponent":"TJ Bižuterie Jablonec n.Nisou \\"D\\"","result":"2 : 3 ","isHome":false},{"round":"4","date":"2025/12/14","opponent":"TJ Desko Liberec \\"C\\"","result":" :  ","isHome":false},{"round":"4","date":"2025/12/14","opponent":"TJ Jiskra Tanvald \\"B\\"","result":" :  ","isHome":false},{"round":"5","date":"2026/01/11","opponent":"ŠK Slavia Liberec \\"B\\"","result":" :  ","isHome":true},{"round":"5","date":"2026/01/11","opponent":"TJ Bižuterie Jablonec n.Nisou \\"D\\"","result":" :  ","isHome":false},{"round":"6","date":"2026/01/25","opponent":"ŠK Slavia Liberec \\"B\\"","result":" :  ","isHome":false},{"round":"6","date":"2026/01/25","opponent":"TJ Spartak Rokytnice n.Jizerou","result":" :  ","isHome":false},{"round":"7","date":"2026/02/08","opponent":"TJ Bižuterie Jablonec n.Nisou \\"D\\"","result":" :  ","isHome":false},{"round":"7","date":"2026/02/08","opponent":"volno","result":" :  ","isHome":true}]	2025-12-09 14:02:51.806
3824	ks-vychod	ŠK Slavia Liberec "B"	5	6.5	1	0	1	2	4	[]	2025-12-09 14:02:51.957
3825	ks-vychod	TJ Bižuterie Jablonec n.Nisou "D"	6	3.5	0	0	2	2	2	[{"round":"1","date":"2025/11/02","opponent":"TJ Bižuterie Jablonec n.Nisou \\"C\\"","result":"3½ : 1½ ","isHome":false},{"round":"2","date":"2025/11/16","opponent":"ŠK ZIKUDA Turnov \\"F\\"","result":"3 : 2 ","isHome":false},{"round":"2","date":"2025/11/16","opponent":"volno","result":" :  ","isHome":true},{"round":"3","date":"2025/11/30","opponent":"TJ Bižuterie Jablonec n.Nisou \\"C\\"","result":"2½ : 2½ ","isHome":false},{"round":"3","date":"2025/11/30","opponent":"ŠK ZIKUDA Turnov \\"F\\"","result":"2 : 3 ","isHome":true},{"round":"4","date":"2025/12/14","opponent":"TJ Desko Liberec \\"C\\"","result":" :  ","isHome":false},{"round":"4","date":"2025/12/14","opponent":"TJ Jiskra Tanvald \\"B\\"","result":" :  ","isHome":false},{"round":"5","date":"2026/01/11","opponent":"TJ Bižuterie Jablonec n.Nisou \\"C\\"","result":" :  ","isHome":false},{"round":"5","date":"2026/01/11","opponent":"TJ Jiskra Tanvald \\"B\\"","result":" :  ","isHome":true},{"round":"6","date":"2026/01/25","opponent":"ŠK Slavia Liberec \\"B\\"","result":" :  ","isHome":false},{"round":"6","date":"2026/01/25","opponent":"TJ Spartak Rokytnice n.Jizerou","result":" :  ","isHome":false},{"round":"7","date":"2026/02/08","opponent":"TJ Spartak Rokytnice n.Jizerou","result":" :  ","isHome":true},{"round":"7","date":"2026/02/08","opponent":"TJ Bižuterie Jablonec n.Nisou \\"C\\"","result":" :  ","isHome":false}]	2025-12-09 14:02:52.106
3826	ks-vychod	TJ Jiskra Tanvald "B"	7	2	0	0	2	2	2	[]	2025-12-09 14:02:52.254
3827	kp-liberec	ŠK Zikuda Turnov "E"	1	9	3	0	0	3	17	[]	2025-12-09 14:02:52.851
3828	kp-liberec	TJ Jiskra Tanvald	2	7	2	1	0	3	16.5	[]	2025-12-09 14:02:53.001
3829	kp-liberec	Desko Liberec "B"	3	6	2	0	1	3	15.5	[]	2025-12-09 14:02:53.15
3830	kp-liberec	ŠK Frýdlant	4	6	2	0	1	3	12	[]	2025-12-09 14:02:53.299
3831	kp-liberec	TJ Bižuterie Jablonec n.N. "A"	5	4	1	1	1	3	13.5	[{"round":"1","date":"2025/11/09","opponent":"TJ Bižuterie Jablonec n.N. \\"B\\"","result":"6½ : 1½ ","isHome":true},{"round":"2","date":"2025/11/23","opponent":"TJ Bižuterie Jablonec n.N. \\"B\\"","result":"3 : 5 ","isHome":false},{"round":"2","date":"2025/11/23","opponent":"TJ Jiskra Tanvald","result":"4 : 4 ","isHome":true},{"round":"3","date":"2025/12/07","opponent":"TJ Jiskra Tanvald","result":"7 : 1 ","isHome":false},{"round":"3","date":"2025/12/07","opponent":"ŠK Zikuda Turnov \\"E\\"","result":"5 : 3 ","isHome":false},{"round":"4","date":"2026/01/18","opponent":"TJ Bižuterie Jablonec n.N. \\"B\\"","result":" :  ","isHome":false},{"round":"4","date":"2026/01/18","opponent":"ŠK Frýdlant","result":" :  ","isHome":true},{"round":"5","date":"2026/02/01","opponent":"ŠK Zikuda Turnov \\"E\\"","result":" :  ","isHome":false},{"round":"5","date":"2026/02/01","opponent":"1.Novoborský ŠK \\"B\\"","result":" :  ","isHome":false},{"round":"6","date":"2026/02/15","opponent":"TJ Bižuterie Jablonec n.N. \\"B\\"","result":" :  ","isHome":false},{"round":"6","date":"2026/02/15","opponent":"ŠK Česká Lípa \\"B\\"","result":" :  ","isHome":true},{"round":"7","date":"2026/03/01","opponent":"ŠK Frýdlant","result":" :  ","isHome":false},{"round":"7","date":"2026/03/01","opponent":"Desko Liberec \\"B\\"","result":" :  ","isHome":false},{"round":"8","date":"2026/03/22","opponent":"TJ Bižuterie Jablonec n.N. \\"B\\"","result":" :  ","isHome":false},{"round":"8","date":"2026/03/22","opponent":"ŠK Slavia Liberec","result":" :  ","isHome":true},{"round":"9","date":"2026/04/12","opponent":"1.Novoborský ŠK \\"B\\"","result":" :  ","isHome":false},{"round":"9","date":"2026/04/12","opponent":"TJ Lokomotiva Liberec","result":" :  ","isHome":false}]	2025-12-09 14:02:53.448
3832	kp-liberec	1.Novoborský ŠK "B"	6	4	1	1	1	3	10.5	[]	2025-12-09 14:02:53.596
3833	kp-liberec	ŠK Slavia Liberec	8	3	1	0	2	3	13	[]	2025-12-09 14:02:53.745
3834	kp-liberec	TJ Lokomotiva Liberec	9	0	0	0	3	3	6	[]	2025-12-09 14:02:53.894
3835	kp-liberec	TJ Bižuterie Jablonec n.N. "B"	10	0	0	0	3	3	5.5	[{"round":"1","date":"2025/11/09","opponent":"TJ Bižuterie Jablonec n.N. \\"A\\"","result":"6½ : 1½ ","isHome":false},{"round":"2","date":"2025/11/23","opponent":"ŠK Česká Lípa \\"B\\"","result":"3 : 5 ","isHome":true},{"round":"2","date":"2025/11/23","opponent":"TJ Bižuterie Jablonec n.N. \\"A\\"","result":"4 : 4 ","isHome":false},{"round":"3","date":"2025/12/07","opponent":"TJ Jiskra Tanvald","result":"7 : 1 ","isHome":false},{"round":"3","date":"2025/12/07","opponent":"ŠK Zikuda Turnov \\"E\\"","result":"5 : 3 ","isHome":false},{"round":"4","date":"2026/01/18","opponent":"Desko Liberec \\"B\\"","result":" :  ","isHome":true},{"round":"4","date":"2026/01/18","opponent":"TJ Bižuterie Jablonec n.N. \\"A\\"","result":" :  ","isHome":false},{"round":"5","date":"2026/02/01","opponent":"ŠK Zikuda Turnov \\"E\\"","result":" :  ","isHome":false},{"round":"5","date":"2026/02/01","opponent":"1.Novoborský ŠK \\"B\\"","result":" :  ","isHome":false},{"round":"6","date":"2026/02/15","opponent":"ŠK Slavia Liberec","result":" :  ","isHome":true},{"round":"6","date":"2026/02/15","opponent":"TJ Bižuterie Jablonec n.N. \\"A\\"","result":" :  ","isHome":false},{"round":"7","date":"2026/03/01","opponent":"ŠK Frýdlant","result":" :  ","isHome":false},{"round":"7","date":"2026/03/01","opponent":"Desko Liberec \\"B\\"","result":" :  ","isHome":false},{"round":"8","date":"2026/03/22","opponent":"TJ Lokomotiva Liberec","result":" :  ","isHome":true},{"round":"8","date":"2026/03/22","opponent":"TJ Bižuterie Jablonec n.N. \\"A\\"","result":" :  ","isHome":false},{"round":"9","date":"2026/04/12","opponent":"1.Novoborský ŠK \\"B\\"","result":" :  ","isHome":false},{"round":"9","date":"2026/04/12","opponent":"TJ Lokomotiva Liberec","result":" :  ","isHome":false}]	2025-12-09 14:02:54.042
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.system_settings (key, value) FROM stdin;
maintenance_mode	false
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, username, email, password_hash, role, created_at) FROM stdin;
2	filip	filip@sachyjablonec.cz	$2b$10$LADdf.J5QssMNXq5/y8GP.DOhrzEM.BS173.LVH9pR9ACYvBaTuX2	editor	2025-12-06 13:47:58.272
3	lukas	lukas@sachyjablonec.cz	$2b$10$Je5Sgb/e.PZq8bb1nE60S.OT67pvLxtSdAxpacqgvJMJ6g.B6xB9G	editor	2025-12-06 13:47:58.794
1	admin	admin@sachyjablonec.cz	$2b$10$blYB7zSOzxO.hvsK42nSHOHUe5z3/zWrKyJTyU0cQM02WvVqdHH6W	superadmin	2025-12-04 19:37:40.716
\.


--
-- Name: Message_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Message_id_seq"', 1, true);


--
-- Name: blicak_registrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.blicak_registrations_id_seq', 6, true);


--
-- Name: games_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.games_id_seq', 1, false);


--
-- Name: images_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.images_id_seq', 46, true);


--
-- Name: match_reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.match_reports_id_seq', 1, false);


--
-- Name: members_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.members_id_seq', 1, true);


--
-- Name: news_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.news_id_seq', 52, true);


--
-- Name: standings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.standings_id_seq', 3835, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 3, true);


--
-- Name: Message Message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_pkey" PRIMARY KEY (id);


--
-- Name: blicak_registrations blicak_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blicak_registrations
    ADD CONSTRAINT blicak_registrations_pkey PRIMARY KEY (id);


--
-- Name: competitions competitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitions
    ADD CONSTRAINT competitions_pkey PRIMARY KEY (id);


--
-- Name: games games_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_pkey PRIMARY KEY (id);


--
-- Name: images images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT images_pkey PRIMARY KEY (id);


--
-- Name: match_reports match_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_reports
    ADD CONSTRAINT match_reports_pkey PRIMARY KEY (id);


--
-- Name: members members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_pkey PRIMARY KEY (id);


--
-- Name: news news_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news
    ADD CONSTRAINT news_pkey PRIMARY KEY (id);


--
-- Name: standings standings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standings
    ADD CONSTRAINT standings_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: match_reports_news_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX match_reports_news_id_key ON public.match_reports USING btree (news_id);


--
-- Name: news_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX news_slug_key ON public.news USING btree (slug);


--
-- Name: standings_competition_id_team_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX standings_competition_id_team_key ON public.standings USING btree (competition_id, team);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_username_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username);


--
-- Name: games games_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.match_reports(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: match_reports match_reports_news_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_reports
    ADD CONSTRAINT match_reports_news_id_fkey FOREIGN KEY (news_id) REFERENCES public.news(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: news news_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news
    ADD CONSTRAINT news_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: standings standings_competition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standings
    ADD CONSTRAINT standings_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.competitions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict bDczhj2qO7uxhKFGxwP0Jblqz4QmMd98RGjMS9gotjmoqVQP4VlKRc7CAEVFebr

