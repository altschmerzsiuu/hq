import asyncio
from datetime import datetime, timezone, timedelta
import json
import sys
sys.path.append('/app')
from routers.estrus_report import _html_to_pdf, TEMPLATE_DIR, _fmt_indonesian_date
from jinja2 import Environment, FileSystemLoader

async def main():
    sensor_data_list = [
        {'time': '28 Jun 08:00', 'temperature': 38.5, 'activity': 'Ruminating'},
        {'time': '28 Jun 09:00', 'temperature': 38.6, 'activity': 'Ruminating'},
        {'time': '28 Jun 10:00', 'temperature': 39.2, 'activity': 'Active'},
        {'time': '28 Jun 11:00', 'temperature': 39.8, 'activity': 'Active'},
        {'time': '28 Jun 12:00', 'temperature': 38.1, 'activity': 'Resting'}
    ]
    context = {
        'farm_name': 'Peternakan Makmur Jaya',
        'generated_date': _fmt_indonesian_date(datetime.now(timezone(timedelta(hours=8)))),
        'period': '2024-06-28 hingga 2024-07-28',
        'cow': {
            'id': '4',
            'nama': 'Sapi D12 (Wage)',
            'jenis': 'Limousin',
            'bulan_tahun_lahir': 'Januari 2020',
            'status_kesehatan': 'Sehat',
            'collar_id': 'COL-004',
        },
        'reproduksi': {
            'total_ib': 2,
            'last_ib_date': '2023-12-01',
            'last_status': 1
        },
        'sensor_data_json': json.dumps(sensor_data_list)
    }

    env      = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))
    template = env.get_template('estrus_report_template.html')
    html     = template.render(**context)

    print('Rendering HTML to PDF...')
    pdf_bytes = await _html_to_pdf(html)
    with open('/app/Laporan_Medis_Sapi_D12.pdf', 'wb') as f:
        f.write(pdf_bytes)
    print('Saved to /app/Laporan_Medis_Sapi_D12.pdf')

asyncio.run(main())
