FROM python:3.11-slim

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends     build-essential     gcc     && rm -rf /var/lib/apt/lists/*

# Set working dir
WORKDIR /app

# Copy backend code
COPY . /app

# Install Python dependencies
RUN pip install --upgrade pip
RUN pip install -r backend/requirements.txt

# Expose the port that Render will set via $PORT
ENV PORT 8000
EXPOSE 8000

# Use uvicorn to serve the FastAPI app; PORT is provided by Render at runtime.
CMD ["sh", "-c", "uvicorn backend.app:app --host 0.0.0.0 --port ${PORT:-8000}"]
