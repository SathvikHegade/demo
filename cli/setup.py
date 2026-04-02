from setuptools import setup, find_packages

version = "1.0.0"

setup(
    name='dataforge-cli',
    version=version,
    py_modules=["dataforge_cli"],
    include_package_data=True,
    install_requires=[
        'click',
        'rich',
        'requests'
    ],
    entry_points='''
        [console_scripts]
        dataforge=dataforge_cli:cli
    ''',
    author="Your Name",
    description="DataForge CLI Tool for quality analysis without UI",
)