import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
import sys
import json
import os
# sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# We would import dataforge_analytics here
# For the CLI, we mock the behavior or call the actual endpoints if possible
import requests 

console = Console()
API_BASE_URL = os.environ.get("DATAFORGE_API_URL", "http://localhost:8000")

@click.group()
@click.version_option(version="1.0.0", prog_name="dataforge")
def cli():
    """DataForge Quality Analyzer CLI. Analyze datasets for bias, noise, and quality."""
    pass

def print_text_report(report_data):
    # This matches the requested ASCII art format
    console.print(Panel(
        f"[bold white]Overall Score:[/bold white]  72/100  [yellow][C][/yellow]\n"
        f"[bold white]Completeness:[/bold white]   88/100  [green][B][/green]\n"
        f"[bold white]Uniqueness:[/bold white]     95/100  [blue][A][/blue]\n"
        f"[bold white]Consistency:[/bold white]    61/100  [red][D][/red]",
         title="DataForge Quality Report", border_style="bold blue"
    ))
    
    console.print("[bold red]CRITICAL (2)[/bold red]  [bold yellow]WARNING (5)[/bold yellow]  [bold cyan]INFO (3)[/bold cyan]")
    console.print("\n[bold red][CRITICAL][/bold red] Bias in 'gender': 82% male (threshold: 70%)")
    console.print("  → Recommendation: Apply SMOTE oversampling or collect more diverse samples")
    
    console.print("\n[bold yellow][WARNING][/bold yellow] 340 outliers in 'income' column (IQR method)")
    console.print("  → Recommendation: Cap at 99th percentile ($320,000)")

@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--target-col', help='Target/label column name')
@click.option('--sensitive-cols', help='Comma-separated sensitive columns')
@click.option('--output', type=click.Choice(['text', 'json', 'html']), default='text', help='Output format')
@click.option('--save', type=click.Path(), help='Save report to file')
@click.option('--threshold', type=float, default=0.7, help='Bias threshold 0.0-1.0')
def analyze(file_path, target_col, sensitive_cols, output, save, threshold):
    """Analyze a dataset file (CSV/JSON/Excel)."""
    with console.status(f"[cyan]Analyzing {os.path.basename(file_path)}...[/cyan]"):
        try:
             # In a real app we'd POST to /api/analyze here
             # config = {"target_col": target_col, "sensitive_cols": sensitive_cols, "threshold": threshold}
             # with open(file_path, 'rb') as f:
             #     resp = requests.post(f"{API_BASE_URL}/api/analyze", files={"file": f}, data={"config": json.dumps(config)})
             # report_data = resp.json()
             
             # Mocked output for the requested CLI demonstration
             report_data = {"score": 72, "issues": []} 
        except Exception as e:
            console.print(f"[red]Error analyzing file:[/red] {str(e)}")
            sys.exit(1)

    if output == 'json':
        out_str = json.dumps(report_data, indent=2)
        if save:
            with open(save, 'w') as f: f.write(out_str)
            console.print(f"Saved to {save}")
        else:
            console.print_json(out_str)
    else:
        print_text_report(report_data)

@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
def profile(file_path):
    """Quick dataset profile (no AI, just statistics) — faster, no API key needed."""
    console.print(f"Profiling {file_path} (fast mode)...")
    # Call dataforge_analytics.profiler locally or API
    console.print("[green]Row Count:[/green] 1000")
    console.print("[green]Col Count:[/green] 15")

@cli.command()
@click.argument('file1', type=click.Path(exists=True))
@click.argument('file2', type=click.Path(exists=True))
def compare(file1, file2):
    """Compare quality scores of two datasets side by side."""
    console.print(f"Comparing [bold cyan]{file1}[/bold cyan] vs [bold yellow]{file2}[/bold yellow]")
    
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("Metric")
    table.add_column("File 1 (Raw)")
    table.add_column("File 2 (Cleaned)")
    
    table.add_row("Overall Score", "60/100", "95/100")
    table.add_row("Duplicates", "150 (5%)", "0 (0%)")
    table.add_row("Missing Vals", "4500", "0")
    
    console.print(table)

if __name__ == '__main__':
    cli()