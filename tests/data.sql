--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;

SET search_path = public, pg_catalog;

--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: isaachodes
--

COPY projects (id, name, notes) FROM stdin;
\.


--
-- Name: projects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: isaachodes
--

SELECT pg_catalog.setval('projects_id_seq', 1, false);


--
-- PostgreSQL database dump complete
--

