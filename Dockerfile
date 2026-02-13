# Multi-stage Docker build for MapVisual Visualization Engine

# Stage 1: Build stage
FROM python:3.10-slim AS builder

# Set working directory
WORKDIR /build

# Install curl for downloading dependencies
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --user -r requirements.txt

# Copy scripts and create directories
COPY scripts/ ./scripts/
RUN mkdir -p static/js data/topojson

# Download D3.js, TopoJSON, and topology data
RUN chmod +x ./scripts/download_dependencies.sh && \
    ./scripts/download_dependencies.sh

# Stage 2: Runtime stage
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Copy Python dependencies from builder
COPY --from=builder /root/.local /root/.local

# Copy downloaded JS libraries from builder
COPY --from=builder /build/static/js/d3.min.js ./static/js/
COPY --from=builder /build/static/js/topojson.min.js ./static/js/

# Update PATH to include local Python packages
ENV PATH=/root/.local/bin:$PATH

# Copy application code and data (repo data first)
COPY app/ ./app/
COPY templates/ ./templates/
COPY static/ ./static/
COPY data/ ./data/

# Overwrite only states TopoJSON from builder (full state boundaries); keep repo's counties file
COPY --from=builder /build/data/topojson/us_states.topo.json ./data/topojson/us_states.topo.json

# Expose port 8080 for Google Cloud Run compatibility
EXPOSE 8080

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')"

# Run the application
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
