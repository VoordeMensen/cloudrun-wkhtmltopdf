# Use the official Node.js Debian Buster image as the base image
FROM node:16-buster

# Install required dependencies
RUN apt-get update && \
    apt-get install -y \
    fontconfig \
    libxrender1 \
    xfonts-75dpi \
    xfonts-base \
    wget \
    && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Download and install the specified wkhtmltopdf package
RUN wget https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6-1/wkhtmltox_0.12.6-1.stretch_amd64.deb && \
    dpkg -i wkhtmltox_0.12.6-1.stretch_amd64.deb || true && \
    apt-get update && \
    apt-get -f install -y && \
    rm wkhtmltox_0.12.6-1.stretch_amd64.deb

# Create a symlink to wkhtmltopdf in /usr/local/bin
RUN ln -s /usr/local/bin/wkhtmltopdf /usr/bin/wkhtmltopdf

# Set the XDG_RUNTIME_DIR environment variable
ENV XDG_RUNTIME_DIR=/tmp/runtime-root

# Create the app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm ci

# Bundle app source
COPY . .

# Expose the port the app will run on
EXPOSE 8080

# Define the command to run the app
CMD [ "npm", "start" ]
