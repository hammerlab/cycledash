# -*- coding: utf-8 -*-
from seltest import url, waitfor, dontwaitfor, Base, hide
from selenium.webdriver.support.ui import Select
from selenium.webdriver.common.action_chains import ActionChains


BASE = 'localhost:5001'


class Website(Base):
    window_size = [1280, 800]
    base_url = BASE

    @url('/about')
    def about_page(self, driver):
        """The about/API documentation page."""
        pass

    @hide('span.time')
    @url('/comments')
    def comments(self, driver):
        """Initial view of the comments page."""
        pass

class Runs(Base):
    window_size = [1280, 800]
    base_url = BASE

    @hide('span.time')
    def page(self, driver):
        """Initial view of the runs page."""
        pass

    @hide('span.time')
    def info(self, driver):
        """Showing an expanded run row and information."""
        run = driver.find_element_by_css_selector('tr.run')
        run.click()

    @hide('span.time')
    def bams(self, driver):
        """Showing the list of BAMs in a project."""
        bam_btn_sel = 'div.project:last-child .project-stats a:first-child'
        bams = driver.find_element_by_css_selector(bam_btn_sel)
        bams.click()

    @hide('span.time')
    def add_bam(self, driver):
        """Showing the Add BAM form."""
        add_bam_btn_sel = 'div.project:last-child .add button:first-child'
        add_bam = driver.find_element_by_css_selector(add_bam_btn_sel)
        add_bam.click()

    @hide('span.time')
    def add_run(self, driver):
        """Showing the Add Run form."""
        add_run_btn_sel = 'div.project:last-child .add button:last-child'
        add_run = driver.find_element_by_css_selector(add_run_btn_sel)
        add_run.click()

class Tasks(Base):
    window_size = [1280, 800]
    base_url = BASE + '/runs/1/tasks'

    def page(self, driver):
        """Tasks view for a particular run."""
        pass

class Examine(Base):
    window_size = [1280, 800]
    base_url = BASE + '/runs/1/examine'
    wait_for = {'css_selector': '.query-status', 'classes': ['good']}

    def base(self, driver):
        """Initial view of a fully-loaded Examine page."""
        pass

    @waitfor('tr:first-child td:nth-child(20)', text='0')
    def sorted(self, driver):
        """Examine page sorted by decreasing Normal Read Depth."""
        rd = driver.find_element_by_css_selector('[data-attribute="sample:RD"] a')
        rd.click()

    @waitfor('[data-attribute="info:DP"] .tooltip')
    def tooltip(self, driver):
        """Examine page showing a Normal Read Depth tooltip."""

        dp = driver.find_element_by_css_selector('[data-attribute="sample:RD"]')
        hover = ActionChains(driver).move_to_element(dp)
        hover.perform()

    @url('?query=sample_name+%3D+NORMAL+AND+info%3ADP+%3E+50+ORDER+BY+info%3ADP%2C+sample%3ARD+DESC')
    def filter(self, driver):
        """Examine page showing a filtered view."""
        pass

    @hide('span.time')
    def comments_view(self, driver):
        """Examine page showing a comment in view mode."""
        row = driver.find_element_by_css_selector('tbody tr')
        row.click()

    @hide('span.time')
    def comments_edit(self, driver):
        """Examine page showing a comment in edit mode."""
        row = driver.find_element_by_css_selector('tbody tr')
        row.click()
        btn = driver.find_elements_by_css_selector('.comment-edit')[1]
        btn.click()

    @dontwaitfor('.query-status')
    @waitfor('.query-status', classes=['bad'])
    def bad_query(self, driver):
        """Examine page showing a poorly formed query."""
        input = driver.find_element_by_css_selector('input[type="text"].tt-input')
        input.send_keys('bad query is so bad')

    @waitfor('tr:nth-child(12) td:nth-child(2)', text=u'✓')
    def validation(self, driver):
        """Examine page with a validation."""
        select = Select(driver.find_element_by_tag_name('select'))
        select.select_by_visible_text('file:///tmp/truthy-snv.vcf')
